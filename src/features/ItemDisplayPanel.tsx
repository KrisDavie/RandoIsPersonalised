import _items from "../data/items.json"

interface IItems {
  [key: string]: IItemInfo
}

interface IItemInfo {
  loc: number[]
  id: number
}

const SpriteLocs: IItems = _items

const SHEET_WIDTH = 20
const SHEET_HEIGHT = 9

function ItemDisplayPanel(props: { sentItems: [string, number][]}) {
  const sortedItems = props.sentItems.toSorted((a, b) => a[1] - b[1])
  // make unique
  const filteredItems = sortedItems.filter((item, index) => {
    return sortedItems.findIndex((i) => i[1] === item[1]) === index
  })
  const itemList = filteredItems.map((item: any) => {
    let item_name = item[0]
    if (SpriteLocs[item_name] === undefined) return
    const posX = (SHEET_HEIGHT - SpriteLocs[item_name]['loc'][0]) * 16
    const posY = (SHEET_WIDTH - SpriteLocs[item_name]['loc'][1]) * 16

    return (
      <div
        key={item[1]}
        className="h-[16px] w-[16px] bg-sprite"
        style={{
          backgroundPositionX: `${posY}px`,
          backgroundPositionY: `${posX}px`,
        }}
        title={item[0]} // Add hoverable element
      ></div>
    )    
  })
  
  return (
    <div className="flex flex-row flex-wrap align-middle items-center max-w-[240px]">
      {itemList}
    </div>
  )
}

export default ItemDisplayPanel
