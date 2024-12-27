import Ajv, { JSONSchemaType } from "ajv"
import _items from "../data/items.json"
import _categories from "../data/categories.json"

export interface IItems {
  [key: string]: IItemInfo
}

export interface IItemInfo {
  loc: number[]
  id: number
}

export interface ICategories {
  [key: string]: string[]
}

const ajvq = new Ajv()

export const items: IItems = _items
export const categories: ICategories = _categories

interface RIPConfig {
  settings: {
    intervals: {
      start: number
      end: number	
      frequency: number
      items: string[]
      weightedItems: { [key: string]: number }
      itemsOrdered: string[]
    }[]
  }
}

const allItems = [...Object.keys(items), ...Object.keys(categories), 'all']

const schema: JSONSchemaType<RIPConfig> = {
  type: "object",
  properties: {
    settings: {
      type: "object",
      properties: {
        intervals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              start: { type: "number" },
              end: { type: "number" },
              frequency: { type: "number" },
              items: {
                type: "array",
                items: { type: "string", enum: allItems},
              },
              itemsOrdered: {
                type: "array",
                items: { type: "string", enum: allItems},
              },
              weightedItems: {
                type: "object",
                propertyNames: { enum: allItems },
                additionalProperties: { type: "number" },
                required: [],
              },
            },
            required: ["start", "frequency"],
            oneOf: [
              { required: ["items"] },
              { required: ["itemsOrdered"] },
              { required: ["weightedItems"] },
            ],
            additionalProperties: false
          },
        },
      },
      required: ["intervals"],
    },
  },
  required: ["settings"],
  additionalProperties: false,
}

export function parseConfig(config: string): RIPConfig | null {
  
  const validate = ajvq.compile(schema)
  const parsed = JSON.parse(config)
  const allItems = [...Object.keys(items), ...Object.keys(categories)]
  if (!validate(parsed)) {
    alert('Invalid config:\n' + validate.errors?.map(e => `${e.instancePath}: ${e.message}`).join('\n'))
    return null
  }
  return parsed
}
