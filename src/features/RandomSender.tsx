import { useEffect, useState } from "react"
import ConfigModal from "./ConfigModal"
import { Button } from "@/components/ui/button"
import { ConfigDropdown } from "./ConfigDropdown"
import { useLocalStorage } from "usehooks-ts"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { addItemsToQueue, setItemHistory, setItemQueue, SRAM } from "./sni/sniSlice"
import { Checkbox } from "@/components/ui/checkbox"
import ItemDisplayPanel from "./ItemDisplayPanel"
import seedrandom from "seedrandom"
import { Separator } from "@/components/ui/separator"
import {
  categories as definedCategories,
  items as definedItems,
} from "./ConfigParser"

export function RandomSender() {
  const [lsConfigs] = useLocalStorage(
    "ripConfigs",
    {},
    { serializer: JSON.stringify, deserializer: JSON.parse },
  )

  const [lsGames, setLSGames] = useLocalStorage(
    "ripGames",
    {},
    { serializer: JSON.stringify, deserializer: JSON.parse },
  )
  const [started, setStarted] = useState(false)
  const [config, setConfig] = useState("")
  const [seededRun, setSeededRun] = useState(false)
  const [rngSeed, setRngSeed] = useState("")
  const sram: SRAM = useAppSelector((state) => state.sni.sram)
  const sentItems = useAppSelector((state) => state.sni.itemHistory)
  const itemQueue = useAppSelector((state) => state.sni.itemQueue)
  const receiving = useAppSelector((state) => state.sni.receiving)
  const dispatch = useAppDispatch()

  let allCategories = {...definedCategories}

  const compatible_seed =
    sram["rom_name"] &&
    ["OR"].includes(
      sram["rom_name"]
        .slice(0, 2)
        .map((byte) => String.fromCharCode(byte))
        .join(""),
    )
  const game_mode = sram["game_mode"] && sram["game_mode"][0]
  const seed_name =
    sram["rom_name"] &&
    String.fromCharCode(...sram["rom_name"].filter((byte) => byte !== 0))
  const ingame = game_mode >= 0x05 && game_mode != 0x14 && game_mode <= 0x1b
  const GAME_FPS = 60.0988
  let game_time_seconds = 0

  if (sram["total_time"] && ingame) {
    game_time_seconds = Math.floor(
      (sram["total_time"][0] +
        sram["total_time"][1] * 256 +
        sram["total_time"][2] * 256 * 256) /
        GAME_FPS,
    )
  }

  useEffect(() => {
    if (!config) return
    if ('categories' in JSON.parse(lsConfigs[config])) {
      allCategories = {
        ...allCategories,
        ...JSON.parse(lsConfigs[config]).categories,
      }
    }

  }, [config])

  useEffect(() => {
    if (compatible_seed && seed_name && seed_name in lsGames) {
      setStarted(true)
      setConfig(lsGames[seed_name].config)
      setSeededRun(lsGames[seed_name].seed == seed_name)
      setRngSeed(lsGames[seed_name].seed.toString())
      dispatch(setItemHistory([]))
      dispatch(setItemQueue([]))
    }
  }, [seed_name, started])

  useEffect(() => {
    if (!started || !sram || !ingame) return
    const prev_ix = sram["multiinfo"][0] * 256 + sram["multiinfo"][1]
    const itemsToSend = getItemsToSend(
      lsGames[seed_name].seed,
      JSON.parse(lsConfigs[config]).settings.intervals,
      prev_ix,
      Math.round(((game_time_seconds / 60) + Number.EPSILON) * 100) / 100,
    )
    if (!receiving) dispatch(addItemsToQueue(itemsToSend))
  }, [sram])

  const getRandomItem = (rng: any, seedRng: any, items: string[]) => {
    let item_list: string[] = []
    const round1_item = items[Math.floor(seedRng() * items.length)]
    if (round1_item in allCategories) {
      let category = allCategories[round1_item]
      item_list = [...item_list, ...category]
    } else if (round1_item in definedItems) {
      item_list.push(round1_item)
    } else if (round1_item === "all") {
      item_list = [...item_list, ...Object.keys(definedItems)]
    }
    const selected_item = item_list[Math.floor(rng() * item_list.length)]
    return selected_item
  }

  const getWeightedItem = (rng: any, interval: any): string[] => {
    let allWeights: number[] = Object.values(interval.weightedItems)
    let totalWeight = allWeights.reduce(
      (acc: number, item: number) => acc + item,
      0,
    )
    let rand = rng() * totalWeight
    let curWeight = 0
    for (let item of Object.keys(interval.weightedItems)) {
      curWeight += interval.weightedItems[item]
      if (rand < curWeight) {
        return [item]
      }
    }
    return []
  }

  const getNextItem = (
    rng: any,
    seedRng: any, 
    interval: any,
    itemCount: number,
    intervalCount: number,
  ): [string, number] => {
    if ("items" in interval[1] && interval[1].items.length > 0) {
      return [getRandomItem(rng, seedRng, interval[1].items), itemCount]
    } else if (
      "itemsOrdered" in interval[1] &&
      interval[1].itemsOrdered.length > 0
    ) {
      const next = interval[1].itemsOrdered[(intervalCount - 1) % interval[1].itemsOrdered.length]
      return [getRandomItem(rng, seedRng, [next]), itemCount]
    } else if (
      "weightedItems" in interval[1] &&
      Object.keys(interval[1].weightedItems).length > 0
    ) {
      const weighted = getWeightedItem(rng, interval[1])
      return [getRandomItem(rng, seedRng, weighted), itemCount]
    } else {
      return [getRandomItem(rng, seedRng, ['all']), itemCount]
    }
  }

  // There's probably a much better way to do this,
  // but we check each interval every update and go through all of the items that should be sent
  const getItemsToSend = (
    seed: any,
    configIntervals: Object,
    prev_ix: number,
    minutes: number,
  ) => {
    const rng = seedrandom.alea(seed)
    const seedRng = seedrandom.alea(seed_name)
    // sort intervals by start time
    const intervals = Object.entries(configIntervals).sort(
      (a, b) => a[1].start - b[1].start,
    )
    // add ends to intervals
    intervals.forEach(([_, value], index) => {
      if (index < intervals.length - 1) {
        if (value.frequency == 0) {
          value.frequency = 0.1
        }
        if (value.end) return
        value.end = intervals[index + 1][1].start
      } else {
        value.end = 9999
      }
    })
    let itemCount = 0
    let cumulativeTime = 0
    let itemsToSend: [string, number][] = []
    let itemHistory: [string, number][] = []
    for (let interval of intervals) {
      const int_length = Math.round((interval[1].end - interval[1].start + Number.EPSILON) * 100) / 100
      const int_count = Math.round(int_length / interval[1].frequency)
      let curItem: [string, number]
      let intervalCount = 0
      for (let i = 0; i < int_count; i++) {
        itemCount++
        intervalCount++
        cumulativeTime = Math.round(((cumulativeTime + interval[1].frequency) + Number.EPSILON) * 100) / 100
        if (cumulativeTime >= minutes) break
        curItem = getNextItem(rng, seedRng, interval, itemCount, intervalCount)
        if (itemQueue.includes(curItem)) {
          continue
        } else if (itemCount > prev_ix) {
          itemsToSend.push(curItem)
        } 
        if (!itemHistory.includes(curItem)) {
          itemHistory.push(curItem)
        }
      }
      if (cumulativeTime >= minutes) break
    }
    // TODO: History should include idx to show previous items from a reset etc.
    dispatch(setItemHistory(itemHistory))
    return itemsToSend
  }

  const handleStart = () => {
    if (started) {
      const confirmed = confirm(
        "Are you sure you want to reset settings for this seed?",
      )
      if (!confirmed) return
      setLSGames(
        Object.fromEntries(
          Object.entries(lsGames).filter(([key, _]) => key !== seed_name),
        ),
      )
      setStarted(false)
      setConfig("")
      setSeededRun(false)
      setRngSeed("")
      dispatch(setItemHistory([]))
      dispatch(setItemQueue([]))
    } else {
      let seedArr = new Uint32Array(1)
      if (!seededRun) {
        window.crypto.getRandomValues(seedArr)
      }
      const gameInfo = {
        seed: seededRun ? seed_name : seedArr[0],
        config: config,
      }
      setRngSeed(gameInfo.seed.toString())
      setLSGames({ ...lsGames, [seed_name]: gameInfo })
      setStarted(true)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Rando Is Personalized</h1>
      <br />
      ROM: {seed_name}
      <br />
      {rngSeed && `RNG Seed: ${rngSeed.toString()}`}
      <br />
      <br />
      IGT: {new Date(game_time_seconds * 1000).toISOString().slice(11, 19)}
      <ItemDisplayPanel sentItems={sentItems} />
      <Separator className="my-4" orientation="horizontal" />
      <div className="flex items-center space-x-2 mb-2">
        <Checkbox
          id="seeded"
          checked={seededRun}
          onClick={() => {
            setSeededRun(!seededRun)
          }}
          disabled={started}
        />
        <label
          htmlFor="seeded"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Use ROM ID to seed RNG
        </label>
      </div>
      <ConfigDropdown
        handleSelect={setConfig}
        disabled={started}
        value={config}
      />
      <Button
        disabled={!compatible_seed || !config}
        className="mr-2 mt-2"
        variant="outline"
        onClick={handleStart}
      >
        {started ? "Reset" : "Start"}
      </Button>
      <ConfigModal />
    </div>
  )
}

export default RandomSender
