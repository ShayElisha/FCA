import type { CarrierId } from './carriers'

export type IsraelPort = 'Ashdod' | 'Haifa' | 'Unknown'

export interface ContainerTrackingResult {
  containerNumber: string
  carrierId: CarrierId
  carrierName: string
  status: string
  currentLocation?: string
  originPort?: string
  destinationPort?: string
  israelPort: IsraelPort
  eta: string | null
  etaRaw?: string
  vesselName?: string
  voyageNumber?: string
  retrievedAt: string
  source: 'scrape'
  searchMeta: {
    detectedFromPrefix: boolean
    searchedCarrierIds: CarrierId[]
    strategy: 'prefix' | 'fanout'
  }
}

export interface TrackingError {
  code: string
  message: string
}

export interface SearchProgress {
  phase: 'prefix' | 'fanout' | 'done'
  currentCarrierName?: string
  checked: string[]
  total: number
}
