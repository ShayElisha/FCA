import type { CarrierId } from './carriers.js'

export type IsraelPort = 'Ashdod' | 'Haifa' | 'Unknown'

export interface ScrapeResult {
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

export interface ScrapeError {
  code:
    | 'INVALID_CONTAINER_NUMBER'
    | 'NOT_FOUND'
    | 'TIMEOUT'
    | 'RATE_LIMITED'
    | 'SOURCE_BLOCKED'
    | 'PARSE_FAILED'
    | 'PROVIDER_UNAVAILABLE'
    | 'INTERNAL_ERROR'
  message: string
  details?: string
}

export type CarrierScrapeOutcome =
  | { status: 'found'; data: Omit<ScrapeResult, 'searchMeta'> }
  | { status: 'not_found' }
  | { status: 'blocked'; details?: string }
  | { status: 'error'; details?: string }

export interface SearchProgressEvent {
  type: 'progress'
  phase: 'prefix' | 'fanout' | 'done'
  currentCarrierName?: string
  checked: string[]
  total: number
}

export interface SearchResultEvent {
  type: 'result'
  ok: true
  data: ScrapeResult
}

export interface SearchErrorEvent {
  type: 'result'
  ok: false
  error: ScrapeError
}

export type SearchEvent =
  | SearchProgressEvent
  | SearchResultEvent
  | SearchErrorEvent
