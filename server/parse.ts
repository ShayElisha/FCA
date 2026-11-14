import type { IsraelPort } from './types.js'

const ASHDOD = /\b(ashdod|ilash|\basd\b)/i
const HAIFA = /\b(haifa|ilhfa|\bhfa\b)/i

const ETA_PATTERNS = [
  /(?:eta|estimated\s+time\s+of\s+arrival|estimated\s+arrival)[:\s]+([A-Za-z0-9,/\-\s:]{5,40})/i,
  /(?:arrival|arrives?)[:\s]+([A-Za-z0-9,/\-\s:]{5,40})/i,
]

const VESSEL_PATTERNS = [
  /(?:vessel|ship|voyage)[:\s]+([A-Za-z0-9 \-]{3,60})/i,
]

const STATUS_PATTERNS = [
  /\b(in transit|discharged|gate out|arrived|loaded|emptied|on board|customs hold)\b/i,
]

export function detectIsraelPort(text: string): {
  israelPort: IsraelPort
  destinationPort?: string
} {
  if (ASHDOD.test(text)) return { israelPort: 'Ashdod', destinationPort: 'Ashdod' }
  if (HAIFA.test(text)) return { israelPort: 'Haifa', destinationPort: 'Haifa' }
  return { israelPort: 'Unknown' }
}

export function extractEtaRaw(text: string): string | undefined {
  for (const pattern of ETA_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) return clean(match[1])
  }
  return undefined
}

export function extractVessel(text: string): string | undefined {
  for (const pattern of VESSEL_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) return clean(match[1])
  }
  return undefined
}

export function extractStatus(text: string): string {
  for (const pattern of STATUS_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }
  return 'Unknown'
}

export function pageLooksBlocked(text: string): boolean {
  return /captcha|cloudflare|access denied|attention required|bot detection|verify you are human/i.test(
    text,
  )
}

export function pageLooksNotFound(text: string): boolean {
  return /no results?|not found|no shipment|invalid container|could not find|אין תוצאות|לא נמצא/i.test(
    text,
  )
}

export function parseLooseDate(raw?: string): string | null {
  if (!raw) return null
  const parsed = Date.parse(raw)
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()

  const dmy = raw.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    let year = Number(dmy[3])
    if (year < 100) year += 2000
    const dt = new Date(Date.UTC(year, month - 1, day, 6, 0, 0))
    if (!Number.isNaN(dt.getTime())) return dt.toISOString()
  }
  return null
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/[|·].*$/, '').trim()
}
