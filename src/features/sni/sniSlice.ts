import type { PayloadAction } from "@reduxjs/toolkit"
import { createSlice } from "@reduxjs/toolkit"
import { items as definedItems } from "../ConfigParser"
import { set } from "react-hook-form"

export interface SRAM {
  [key: string]: number[]
}

export interface SniSliceState {
  grpcHost: string
  grpcPort: number
  grpcConnected: boolean
  deviceList: string[]
  receiving: boolean
  connectedDevice?: string
  sram: SRAM,
  itemQueue: [string, number][] // Maybe 
  itemHistory: [string, number][] // Maybe

}

const initialState: SniSliceState = {
  grpcHost: "localhost",
  grpcPort: 8190,
  grpcConnected: false,
  deviceList: [],
  receiving: false,
  connectedDevice: undefined,
  sram: {},
  itemQueue: [],
  itemHistory: [],
}


export const sniSlice = createSlice({
  name: "sni",
  initialState,
  reducers: {
    setGrpcConnected: (state, action: PayloadAction<boolean>) => {
      state.grpcConnected = action.payload
    },
    setGrpcHost: (state, action: PayloadAction<string>) => {
      state.grpcHost = action.payload
    },
    setGrpcPort: (state, action: PayloadAction<number>) => {
      state.grpcPort = action.payload
    },
    setDeviceList: (state, action: PayloadAction<string[]>) => {
      state.deviceList = action.payload
    },
    setConnectedDevice: (state, action: PayloadAction<string>) => {
      state.connectedDevice = action.payload
    },
    setSram: (state, action: PayloadAction<SRAM>) => {
      state.sram = action.payload
    },
    setReceiving: (state, action) => {
      state.receiving = action.payload
    },
    addItemsToQueue: (state, action: PayloadAction<[string, number][]>) => {
      state.itemQueue = [...state.itemQueue, ...action.payload]
    },
    setItemQueue: (state, action: PayloadAction<[string, number][]>) => {
      state.itemQueue = action.payload
    },
    shiftQueue: (state) => {
      const sent = state.itemQueue.shift()
      if (!sent) return
      state.itemHistory = [...state.itemHistory, sent]
    },
    setItemHistory: (state, action: PayloadAction<[string, number][]>) => {
      state.itemHistory = action.payload
    }
  }
})

export const selectAvailableDevices = (state: { sni: SniSliceState }) =>
  state.sni.deviceList

export const {
  setGrpcHost,
  setGrpcPort,
  setGrpcConnected,
  setDeviceList,
  setConnectedDevice,
  setSram,
  setReceiving,
  addItemsToQueue,
  setItemQueue,
  setItemHistory,
  shiftQueue,
} = sniSlice.actions
export default sniSlice.reducer 

export const sniActions = sniSlice.actions