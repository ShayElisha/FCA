export type IsraelPort = 'Ashdod' | 'Haifa' | 'Unknown'

export interface ContainerTrackingResult {
  containerNumber: string
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
  demo: boolean
}

export interface TrackingError {
  code: string
  message: string
}
