import type { RootState } from "@/app/store"
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react"
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport"
import {
  setConnectedDevice,
  setDeviceList,
  setGrpcConnected,
  setReceiving,
  setSram,
  shiftQueue,
} from "./sniSlice"
import {
  DevicesClient,
  DeviceControlClient,
  DeviceMemoryClient,
} from "@/sni/sni.client"
import { AddressSpace, MemoryMapping } from "@/sni/sni"
import type { AppDispatch } from "@/app/store"
import { items as definedItems } from "../ConfigParser"

const getTransport = (state: any) => {
  return new GrpcWebFetchTransport({
    baseUrl: `http://${state.sni.grpcHost}:${state.sni.grpcPort}`,
  })
}

export const ingame_modes = [0x07, 0x09, 0x0b]
export const save_quit_modes = [0x00, 0x01, 0x17, 0x1b, 0xe]



type SRAMLocs = {
  [key: number]: [string, number]
}

const sram_locs: SRAMLocs = {
  0xf50010: ["game_mode", 0x1],
  0xe02000: ["rom_name", 0x15],
  0xf5f43e: ["total_time", 0x3],
  0xf5f443: ["goal_complete", 0x1],
  0xf5f4d0: ["multiinfo", 0x4],
}

let receiving_lock = false

const updateReceiving = (dispatch: AppDispatch, receiving_state: boolean) => {
  dispatch(setReceiving(receiving_state))
  receiving_lock = receiving_state
}

const getReceiveState = (state: RootState) => {
  return state.sni.receiving || receiving_lock
}

export const sniApiSlice = createApi({
  baseQuery: fakeBaseQuery(),
  reducerPath: "sniApi",
  endpoints: (builder) => ({
    getDevices: builder.query({
      async queryFn(
        arg: { noConnect: boolean },
        queryApi,
        extraOptions,
        baseQuery,
      ) {
        const transport = getTransport(queryApi.getState() as RootState)
        try {
          let devClient = new DevicesClient(transport)
          let devicesReponse = await devClient.listDevices({ kinds: [] })
          let devices = devicesReponse.response.devices.map(
            (device) => device.uri,
          )
          queryApi.dispatch(setGrpcConnected(true))
          queryApi.dispatch(setDeviceList(devices))
          if (devices.length > 0 && !arg.noConnect) {
            queryApi.dispatch(setConnectedDevice(devices[0]))
          }
          return { data: devices }
        } catch (e) {
          return { error: "Error getting devices." }
        }
      },
    }),
    reset: builder.mutation({
      async queryFn(arg, queryApi, extraOptions, baseQuery) {
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlClient = new DeviceControlClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (connectedDevice) {
          const res = await controlClient.resetSystem({ uri: connectedDevice })
          return { data: res }
        } else {
          return { error: "No device selected" }
        }
      },
    }),
    sendItem: builder.mutation({
      async queryFn(
        arg: { itemId: number },
        queryApi,
        extraOptions,
        baseQuery,
      ) {
        let state = queryApi.getState() as RootState

        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          return { error: "No device or memory data" }
        }
        let game_mode = 0x00

        while (!ingame_modes.includes(game_mode)) {
          const game_mode_response = await controlMem.singleRead({
            uri: connectedDevice,
            request: {
              requestMemoryMapping: MemoryMapping.LoROM,
              requestAddress: parseInt("f50010", 16),
              requestAddressSpace: AddressSpace.FxPakPro,
              size: 1,
            },
          })
          if (!game_mode_response.response.response) {
            return { error: "Error reading memory, no reposonse" }
          }
          game_mode = game_mode_response.response.response.data[0]

          await new Promise((r) => setTimeout(r, 250))
          state = queryApi.getState() as RootState
        }

        let writeResponse
        let last_item_id = 255
        let last_event_idx = 0

        // Wait for the player to finish receiving before sending the next item
        while (last_item_id != 0) {
          const readCurItem = await controlMem.singleRead({
            uri: connectedDevice,
            request: {
              requestMemoryMapping: MemoryMapping.LoROM,
              requestAddress: parseInt("f5f4d0", 16),
              requestAddressSpace: AddressSpace.FxPakPro,
              size: 3,
            },
          })
          if (!readCurItem.response.response) {
            return { error: "Error reading memory, no reposonse" }
          }
          last_item_id = readCurItem.response.response.data[2]
          last_event_idx =
            readCurItem.response.response.data[0] * 256 +
            readCurItem.response.response.data[1]
          if (last_item_id === 0) {
            if (last_event_idx === 0) {
              // This should never be 0, but the rom sometimes sets it to 0 when changing state
              // Wait for it to be a real value again
              continue
            }
          }
          await new Promise((r) => setTimeout(r, 250))
        }

        let new_event_idx = [
          (last_event_idx + 1) >> 8,
          (last_event_idx + 1) & 0xff,
        ]

        writeResponse = await controlMem.singleWrite({
          uri: connectedDevice,
          request: {
            requestMemoryMapping: MemoryMapping.LoROM,
            requestAddress: parseInt("f5f4d0", 16),
            requestAddressSpace: AddressSpace.FxPakPro,
            data: new Uint8Array([
              new_event_idx[0],
              new_event_idx[1],
              arg.itemId,
              1,
            ]),
          },
        })
        return { data: writeResponse?.response.response?.requestAddress }
      },
    }),
    sendManyItems: builder.mutation({
      async queryFn(arg: {}, queryApi, extraOptions, baseQuery) {
        let state = queryApi.getState() as RootState
        let curQueue = [...state.sni.itemQueue]
        if (curQueue.length === 0) {
          return { error: "No items to send" }
        }
        if (getReceiveState(state)) {
          return { error: "Already receiving" }
        }
        updateReceiving(queryApi.dispatch, true)

        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          updateReceiving(queryApi.dispatch, false)
          return { error: "No device or memory data" }
        }
        // We wait until receiving is set before actually sending items
        let game_mode = 0x00

        // @ts-ignore
        while (!getReceiveState(state) || !ingame_modes.includes(game_mode)) {
          const game_mode_response = await controlMem.singleRead({
            uri: connectedDevice,
            request: {
              requestMemoryMapping: MemoryMapping.LoROM,
              requestAddress: parseInt("f50010", 16),
              requestAddressSpace: AddressSpace.FxPakPro,
              size: 1,
            },
          })
          if (!game_mode_response.response.response) {
            updateReceiving(queryApi.dispatch, false)
            return { error: "Error reading memory, no reposonse" }
          }
          game_mode = game_mode_response.response.response.data[0]

          await new Promise((r) => setTimeout(r, 250))
          state = queryApi.getState() as RootState
        }

        let writeResponse
        // for (let i = 0; i < arg.memVals.length; i++) {
        state = queryApi.getState() as RootState
        while (state.sni.itemQueue.length > 0) {
          state = queryApi.getState() as RootState
          let memVal = state.sni.itemQueue[0]
          if (!memVal) {
            continue
          }
          const event_idx = memVal[1]
          queryApi.dispatch(shiftQueue())
          let last_item_id = 255
          let last_event_idx = 0

          // Wait for the player to finish receiving before sending the next item
          while (last_item_id != 0) {
            const readCurItem = await controlMem.singleRead({
              uri: connectedDevice,
              request: {
                requestMemoryMapping: MemoryMapping.LoROM,
                requestAddress: parseInt("f5f4d0", 16),
                requestAddressSpace: AddressSpace.FxPakPro,
                size: 3,
              },
            })
            if (!readCurItem.response.response) {
              return { error: "Error reading memory, no reposonse" }
            }
            last_item_id = readCurItem.response.response.data[2]
            last_event_idx =
              readCurItem.response.response.data[0] * 256 +
              readCurItem.response.response.data[1]
            if (last_item_id === 0) {
              if (last_event_idx === 0) {
                // This should never be 0, but the rom sometimes sets it to 0 when changing state
                // Wait for it to be a real value again
                continue
              }
              break
            }
            await new Promise((r) => setTimeout(r, 250))
          }

          // Get index of current item and make sure it's greater than the last one so we don't resend any items
          if (event_idx !== last_event_idx + 1) {
            await new Promise((r) => setTimeout(r, 50))
            continue
          }

          writeResponse = await controlMem.singleWrite({
            uri: connectedDevice,
            request: {
              requestMemoryMapping: MemoryMapping.LoROM,
              requestAddress: parseInt("f5f4d0", 16),
              requestAddressSpace: AddressSpace.FxPakPro,
              data: new Uint8Array([
                memVal[1] >> 8,
                memVal[1] & 0xff,
                definedItems[memVal[0]].id,
                0,
              ]),
            },
          })
        }

        // Here we're just going to wait a little bit after sending the last item before then updating the state
        await new Promise((r) => setTimeout(r, 1000))
        updateReceiving(queryApi.dispatch, false)
        return { data: writeResponse?.response.response?.requestAddress }
      },
    }),
    readSRAM: builder.query({
      async queryFn(arg: {}, queryApi, extraOptions, baseQuery) {
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          return { error: "No device selected" }
        }

        let requests = []
        for (let [loc, [name, size]] of Object.entries(sram_locs)) {
          requests.push({
            requestMemoryMapping: MemoryMapping.LoROM,
            requestAddress: parseInt(loc),
            requestAddressSpace: AddressSpace.FxPakPro,
            size: size,
          })
        }

        let multiReadResponse = await controlMem.multiRead({
          uri: connectedDevice,
          requests: requests,
        })

        if (!multiReadResponse.response.responses) {
          return { error: "Error reading memory, no reposonse" }
        }

        let sram = {} as { [key: string]: number[] }
        multiReadResponse.response.responses.forEach((res) => {
          sram[sram_locs[res.requestAddress][0]] = Array.from(res.data)
        })

        queryApi.dispatch(setSram(sram))

        return { data: sram }
      },
    }),
  }),
})

export const {
  useGetDevicesQuery,
  useLazyGetDevicesQuery,
  useSendItemMutation,
  useResetMutation,
  useReadSRAMQuery,
  useSendManyItemsMutation,
} = sniApiSlice
