import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"
import { ConfigDropdown } from "./ConfigDropdown"
import { parseConfig } from "./ConfigParser"
import { useLocalStorage } from "usehooks-ts"
import { ScrollArea } from "@/components/ui/scroll-area"

export function ConfigModal() {
  const [lsConfigs, setLSConfigs, removeLSConfigs] = useLocalStorage(
    "ripConfigs",
    {},
    { serializer: JSON.stringify, deserializer: JSON.parse },
  )
  const [selectedConfig, setSelectedConfig] = useState("")
  const [curConfig, setCurConfig] = useState("")
  const [configName, setConfigName] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const file = files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      if (!e.target) return
      const text = e.target.result as string
      const res = parseConfig(text)
      if (res === null) return
      setCurConfig(text)
    }
    reader.readAsText(file)
  }

  const handleAddConfig = () => {
    const newConfigs = { ...lsConfigs }
    newConfigs[configName] = curConfig
    setLSConfigs(newConfigs)
  }

  const handleDeleteConfig = () => {
    const newConfigs = { ...lsConfigs }
    delete newConfigs[selectedConfig]
    setLSConfigs(newConfigs)
    setSelectedConfig("")
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Configs</Button>
      </DialogTrigger>
      <DialogContent className="max-w-px-425">
        <DialogHeader>
          <DialogTitle>Edit Configs</DialogTitle>
          <DialogDescription>Make changes to configs here.</DialogDescription>
        </DialogHeader>
        <div className="flex-col space-y-2 justify-center">
          <div className="flex justify-between">
            <div className="flex-1 mr-1">
              <Label>Config Name</Label>
              <Input
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
              />
              <Label>Config File</Label>
              <Input type="file" onChange={handleFileChange} />
            </div>
          </div>
          <div className="flex">
            <Button
              variant="default"
              className="flex w-32"
              disabled={configName === "" || curConfig === ""}
              onClick={handleAddConfig}
            >
              Add Config
            </Button>
          </div>
        </div>
        <Separator orientation="horizontal" />
        <div className="flex-col space-y-2">
          <Label className="flex">Current Configs</Label>
          <div className="flex space-x-2">
            <ConfigDropdown handleSelect={setSelectedConfig} />
            <Button
              disabled={selectedConfig === ""}
              onClick={handleDeleteConfig}
              className="w-18"
              variant="destructive"
              type="submit"
            >
              Delete
            </Button>
            <Button
              // disabled={selectedConfig === ""}
              disabled
              className="w-18"
              type="submit"
            >
              Export
            </Button>
          </div>
        </div>
        <DialogFooter className="flex">
          {selectedConfig === "" ? (
            ""
          ) : (
            <div className="flex-1">
              <Label>Selected Config</Label>
              <ScrollArea className="rounded-md border p-1">
                <pre className="text-wrap max-h-[400px]">
                  {lsConfigs[selectedConfig]}
                </pre>
              </ScrollArea>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConfigModal
