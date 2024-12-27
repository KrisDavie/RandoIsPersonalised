import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import SniSettings from "./sni/sniSettings"
import { AlertCircleIcon, CheckIcon, XCircleIcon } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { selectAvailableDevices } from "./sni/sniSlice"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ingame_modes, useGetDevicesQuery, useReadSRAMQuery, useSendManyItemsMutation } from "./sni/sniApiSlice"
import { useEffect } from "react"

function Header() {
  const grpcConnected = useAppSelector((state) => state.sni.grpcConnected)
  const devices: string[] = useAppSelector(selectAvailableDevices)

  const connectedDevice: string | undefined = useAppSelector(
    (state) => state.sni.connectedDevice,
  )

  useGetDevicesQuery(
    { noConnect: false },
    { pollingInterval: 1000, skip: devices.length > 0 },
  )

  const [sendManyItems] = useSendManyItemsMutation()
  const receiving = useAppSelector((state) => state.sni.receiving)

  const sram = useReadSRAMQuery(
    {},
    {
      pollingInterval: 750,
    },
  ).data

  useEffect(() => {
    if (
      !sram ||
      !sram["game_mode"] ||
      !ingame_modes.includes(sram["game_mode"][0])
    ) {
      return
    }
    sendManyItems({})
  }, [receiving, sram])

  return (
    <div className="flex flex-col h-12">
      <div className="flex absolute top-2 right-2 space-x-2">
        <Popover>
          <PopoverTrigger>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline">
                    <div className="pr-2">SNI Settings</div>
                    {!grpcConnected ? (
                      <XCircleIcon color="red" />
                    ) : devices.length === 0 ? (
                      <AlertCircleIcon color="yellow" />
                    ) : (
                      <CheckIcon color="green" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!grpcConnected
                    ? "SNI Not Detected"
                    : devices.length === 0
                      ? "No Devices Found"
                      : "Connected to " + connectedDevice + " via SNI"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto">
            <SniSettings />
          </PopoverContent>
        </Popover>
        <ModeToggle />
      </div>
    </div>
  )
}

export default Header
