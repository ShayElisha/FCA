import {
  CARRIERS,
  detectCarriersByOwnerCode,
  getSearchOrder,
  type Carrier,
  type CarrierId,
} from './carriers'
import type {
  ContainerTrackingResult,
  SearchProgress,
  TrackingError,
} from './types'

export type TrackResponse =
  | { ok: true; data: ContainerTrackingResult }
  | { ok: false; error: TrackingError }

export type ProgressCallback = (progress: SearchProgress) => void

/**
 * Multi-carrier search:
 * 1. Query carriers matching the container owner-code prefix.
 * 2. If not found, fan-out across the remaining lines in parallel batches.
 *
 * Demo providers simulate hits. Real carrier APIs/clients plug into queryCarrier().
 */
export async function trackContainer(
  containerNumber: string,
  onProgress?: ProgressCallback,
): Promise<TrackResponse> {
  const primary = detectCarriersByOwnerCode(containerNumber)
  const order = getSearchOrder(containerNumber)
  const checked: CarrierId[] = []

  const report = (partial: Omit<SearchProgress, 'checked' | 'total'>) => {
    onProgress?.({
      ...partial,
      checked: checked.map((id) => CARRIERS.find((c) => c.id === id)!.name),
      total: order.length,
    })
  }

  // Phase 1 — prefix candidates
  if (primary.length > 0) {
    report({
      phase: 'prefix',
      currentCarrierName: primary.map((c) => c.name).join(', '),
    })

    const primaryHits = await queryCarriersParallel(
      primary,
      containerNumber,
      checked,
      () =>
        report({
          phase: 'prefix',
          currentCarrierName: primary.map((c) => c.name).join(', '),
        }),
    )

    const hit = pickBestHit(primaryHits)
    if (hit) {
      report({ phase: 'done' })
      return {
        ok: true,
        data: {
          ...hit,
          searchMeta: {
            detectedFromPrefix: true,
            searchedCarrierIds: [...checked],
            strategy: 'prefix',
          },
        },
      }
    }
  }

  // Phase 2 — search the rest (containers are often leased / operated by another line)
  const remaining = order.filter((c) => !checked.includes(c.id))
  if (remaining.length > 0) {
    report({
      phase: 'fanout',
      currentCarrierName: remaining[0]?.name,
    })

    const fanoutHits = await queryCarriersParallel(
      remaining,
      containerNumber,
      checked,
      (carrier) =>
        report({
          phase: 'fanout',
          currentCarrierName: carrier.name,
        }),
    )

    const hit = pickBestHit(fanoutHits)
    if (hit) {
      report({ phase: 'done' })
      return {
        ok: true,
        data: {
          ...hit,
          searchMeta: {
            detectedFromPrefix: primary.length > 0,
            searchedCarrierIds: [...checked],
            strategy: 'fanout',
          },
        },
      }
    }
  }

  report({ phase: 'done' })
  const names = order.map((c) => c.name).join(', ')
  return {
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `מספר המכולה לא נמצא אצל אף אחת מחברות הספנות שנסרקו (${names}). נא לוודא את המספר.`,
    },
  }
}

async function queryCarriersParallel(
  carriers: Carrier[],
  containerNumber: string,
  checked: CarrierId[],
  onEach?: (carrier: Carrier) => void,
): Promise<Array<Omit<ContainerTrackingResult, 'searchMeta'> | null>> {
  // Small batches keep UI progress readable and mimic polite rate limits
  const batchSize = 4
  const results: Array<Omit<ContainerTrackingResult, 'searchMeta'> | null> = []

  for (let i = 0; i < carriers.length; i += batchSize) {
    const batch = carriers.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (carrier) => {
        onEach?.(carrier)
        const result = await queryCarrier(carrier, containerNumber)
        checked.push(carrier.id)
        return result
      }),
    )
    results.push(...batchResults)

    const found = batchResults.find(Boolean)
    if (found) return results
  }

  return results
}

function pickBestHit(
  results: Array<Omit<ContainerTrackingResult, 'searchMeta'> | null>,
): Omit<ContainerTrackingResult, 'searchMeta'> | null {
  return results.find((r) => r !== null) ?? null
}

/**
 * Per-carrier query. Replace demo logic with real HTTP/API clients per carrier.
 */
async function queryCarrier(
  carrier: Carrier,
  containerNumber: string,
): Promise<Omit<ContainerTrackingResult, 'searchMeta'> | null> {
  await delay(280 + hash(containerNumber + carrier.id) % 220)

  const primary = detectCarriersByOwnerCode(containerNumber)
  const isPrefixMatch = primary.some((c) => c.id === carrier.id)
  const last = Number(containerNumber[containerNumber.length - 1])

  // Demo rules: digit 0 = not found anywhere; otherwise prefer prefix carrier,
  // or a stable hashed carrier when the prefix is unknown.
  if (last === 0) return null

  const noPrefix = primary.length === 0
  const fallbackCarrier =
    CARRIERS[hash(containerNumber) % CARRIERS.length].id === carrier.id

  if (!isPrefixMatch && !(noPrefix && fallbackCarrier)) {
    return null
  }

  const israelPort = last % 2 === 0 ? 'Ashdod' : 'Haifa'
  const etaDate = new Date()
  etaDate.setDate(etaDate.getDate() + 2 + (last % 6))
  etaDate.setHours(8 + (last % 4), 0, 0, 0)

  return {
    containerNumber,
    carrierId: carrier.id,
    carrierName: carrier.name,
    status: last > 5 ? 'In Transit' : 'Discharged',
    currentLocation: last > 5 ? 'Mediterranean Sea' : israelPort,
    originPort: demoOrigin(carrier.id),
    destinationPort: israelPort,
    israelPort,
    eta: etaDate.toISOString(),
    etaRaw: etaDate.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    vesselName: `${carrier.name.toUpperCase()} ${demoVesselSuffix(carrier.id)}`,
    voyageNumber: `${carrier.id.slice(0, 2).toUpperCase()}${containerNumber.slice(-3)}`,
    retrievedAt: new Date().toISOString(),
    demo: true,
  }
}

function demoOrigin(id: CarrierId): string {
  const map: Record<CarrierId, string> = {
    msc: 'Genova',
    maersk: 'Rotterdam',
    cma_cgm: 'Marseille',
    hapag_lloyd: 'Hamburg',
    cosco: 'Shanghai',
    one: 'Singapore',
    evergreen: 'Kaohsiung',
    zim: 'Haifa',
    yang_ming: 'Keelung',
    hmm: 'Busan',
    oocl: 'Hong Kong',
    pil: 'Singapore',
    wan_hai: 'Taipei',
  }
  return map[id]
}

function demoVesselSuffix(id: CarrierId): string {
  const map: Record<CarrierId, string> = {
    msc: 'ADRATIC',
    maersk: 'ESSEX',
    cma_cgm: 'FORTUNE',
    hapag_lloyd: 'BERLIN',
    cosco: 'STAR',
    one: 'COMMITMENT',
    evergreen: 'MARINE',
    zim: 'CONSTANZA',
    yang_ming: 'ORCHID',
    hmm: 'ALGECIRAS',
    oocl: 'TOKYO',
    pil: 'SOUTH',
    wan_hai: 'BRIDGE',
  }
  return map[id]
}

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0
  }
  return h
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
