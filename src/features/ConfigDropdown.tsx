import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils"
import { useLocalStorage } from "usehooks-ts";



export function ConfigDropdown(props: { handleSelect: (config: string) => void, disabled?: boolean, value?: string }) {

    const [lsConfigs, setLSConfigs, removeLSConfigs] = useLocalStorage('ripConfigs', {}, { serializer: JSON.stringify, deserializer: JSON.parse })
    const configs = Object.keys(lsConfigs)
    const noConfigs = Object.keys(configs).length == 0
    

    return (
        <>
            <Select disabled={noConfigs || (props.disabled === true)} onValueChange={(value) => props.handleSelect(value) } value={props.value}>
                <SelectTrigger>
                    <SelectValue placeholder={noConfigs ? 'No configs...' : 'Select a config'} />
                </SelectTrigger>
                <SelectContent>
                    {
                        configs.map((config, i) => {
                            return <SelectItem key={i} value={config}>{config}</SelectItem>
                        })
                    }
                </SelectContent>
            </Select>
        </>
    )
}