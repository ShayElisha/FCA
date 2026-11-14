export type CarrierId =
  | 'msc'
  | 'maersk'
  | 'cma_cgm'
  | 'hapag_lloyd'
  | 'cosco'
  | 'one'
  | 'evergreen'
  | 'zim'
  | 'yang_ming'
  | 'hmm'
  | 'oocl'
  | 'pil'
  | 'wan_hai'

export interface Carrier {
  id: CarrierId
  name: string
  nameHe: string
  ownerCodes: string[]
  trackingUrl: string
  /** Deep-link that skips the empty landing form when possible */
  directTrackUrl?: (containerNumber: string) => string
  /** Lower = searched earlier in fan-out (Israel trade priority) */
  priority: number
}

export const CARRIERS: Carrier[] = [
  {
    id: 'zim',
    name: 'ZIM',
    nameHe: 'צים',
    ownerCodes: ['ZIM', 'ZCS', 'ZIMU', 'ZCSU'],
    trackingUrl: 'https://www.zim.com/tools/track-a-shipment',
    directTrackUrl: (c) =>
      `https://www.zim.com/tools/track-a-shipment?consNumber=${c}`,
    priority: 1,
  },
  {
    id: 'msc',
    name: 'MSC',
    nameHe: 'MSC',
    ownerCodes: ['MSC'],
    trackingUrl: 'https://www.msc.com/en/track-a-shipment',
    directTrackUrl: (c) =>
      `https://www.msc.com/en/track-a-shipment?trackingNumber=${c}`,
    priority: 2,
  },
  {
    id: 'maersk',
    name: 'Maersk',
    nameHe: 'מארסק',
    ownerCodes: ['MSK', 'MAE', 'MRK', 'MAEU', 'MRSU', 'MWMU'],
    trackingUrl: 'https://www.maersk.com/tracking',
    directTrackUrl: (c) => `https://www.maersk.com/tracking/${c}`,
    priority: 3,
  },
  {
    id: 'cma_cgm',
    name: 'CMA CGM',
    nameHe: 'CMA CGM',
    ownerCodes: ['CMA', 'CGM', 'CMDU', 'CADU'],
    trackingUrl: 'https://www.cma-cgm.com/ebusiness/tracking',
    directTrackUrl: (c) =>
      `https://www.cma-cgm.com/ebusiness/tracking/search?SearchType=2&Reference=${c}`,
    priority: 4,
  },
  {
    id: 'hapag_lloyd',
    name: 'Hapag-Lloyd',
    nameHe: 'הפג-לויד',
    ownerCodes: ['HLX', 'HLC', 'HLCU', 'HASU', 'HLXU'],
    trackingUrl: 'https://www.hapag-lloyd.com/en/online-business/track.html',
    priority: 5,
  },
  {
    id: 'one',
    name: 'ONE',
    nameHe: 'ONE',
    ownerCodes: ['ONE', 'ONY', 'NYK', 'MOL', 'KKT', 'ONEY', 'MOAU'],
    trackingUrl:
      'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking',
    priority: 6,
  },
  {
    id: 'cosco',
    name: 'COSCO',
    nameHe: 'COSCO',
    ownerCodes: ['CSN', 'COS', 'CBHU', 'COSU', 'CSNU', 'CCLU', 'CSLU'],
    trackingUrl:
      'https://elines.coscoshipping.com/ebusiness/cargoTracking',
    directTrackUrl: (c) =>
      `https://elines.coscoshipping.com/scct/public/ct/base?lang=en&trackingType=container&number=${c}`,
    priority: 7,
  },
  {
    id: 'evergreen',
    name: 'Evergreen',
    nameHe: 'אברגרין',
    ownerCodes: ['EGH', 'EIS', 'EMC', 'EITU', 'EMCU', 'EGHU'],
    trackingUrl: 'https://www.evergreen-line.com/',
    priority: 8,
  },
  {
    id: 'oocl',
    name: 'OOCL',
    nameHe: 'OOCL',
    ownerCodes: ['OOL', 'OOLU'],
    trackingUrl:
      'https://www.oocl.com/eng/ourservices/eservices/cargotracking',
    priority: 9,
  },
  {
    id: 'hmm',
    name: 'HMM',
    nameHe: 'HMM',
    ownerCodes: ['HDM', 'HMM', 'HDMU', 'HMMU'],
    trackingUrl:
      'https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.do',
    priority: 10,
  },
  {
    id: 'yang_ming',
    name: 'Yang Ming',
    nameHe: 'יאנג מינג',
    ownerCodes: ['YML', 'YMCU', 'YMLU'],
    trackingUrl:
      'https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx',
    priority: 11,
  },
  {
    id: 'pil',
    name: 'PIL',
    nameHe: 'PIL',
    ownerCodes: ['PCI', 'PCIU'],
    trackingUrl: 'https://www.pilship.com/',
    priority: 12,
  },
  {
    id: 'wan_hai',
    name: 'Wan Hai',
    nameHe: 'ואן האי',
    ownerCodes: ['WHL', 'WHLU'],
    trackingUrl: 'https://www.wanhai.com/views/cargoTrack.xhtml',
    priority: 13,
  },
]

const OWNER_CODE_INDEX = buildOwnerIndex()

function buildOwnerIndex(): Map<string, CarrierId> {
  const map = new Map<string, CarrierId>()
  for (const carrier of CARRIERS) {
    for (const code of carrier.ownerCodes) {
      map.set(code.toUpperCase(), carrier.id)
    }
  }
  return map
}

export function getCarrier(id: CarrierId): Carrier {
  return CARRIERS.find((c) => c.id === id)!
}

export function detectCarriersByOwnerCode(containerNumber: string): Carrier[] {
  const owner3 = containerNumber.slice(0, 3).toUpperCase()
  const owner4 = containerNumber.slice(0, 4).toUpperCase()
  const matched = new Set<CarrierId>()
  const id4 = OWNER_CODE_INDEX.get(owner4)
  const id3 = OWNER_CODE_INDEX.get(owner3)
  if (id4) matched.add(id4)
  if (id3) matched.add(id3)
  return [...matched].map(getCarrier)
}

/** Prefix first, then Israel-priority fan-out */
export function getSearchOrder(containerNumber: string): Carrier[] {
  const primary = detectCarriersByOwnerCode(containerNumber)
  const primaryIds = new Set(primary.map((c) => c.id))
  const rest = CARRIERS.filter((c) => !primaryIds.has(c.id)).sort(
    (a, b) => a.priority - b.priority,
  )
  return [...primary, ...rest]
}
