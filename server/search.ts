import {
  CARRIERS,
  detectCarriersByOwnerCode,
  getSearchOrder,
  type Carrier,
  type CarrierId,
} from './carriers.js'
import { scrapeCarrier } from './scrapers/index.js'
import type { ScrapeResult, SearchEvent } from './types.js'

const THROTTLE_MS = Number(process.env.SCRAPE_THROTTLE_MS ?? 1500)

/**
 * Multi-carrier search using browser scraping only (no carrier APIs).
 * 1) Prefix carriers first
 * 2) Fan-out across remaining lines
 */
export async function* searchAcrossCarriers(
  containerNumber: string,
): AsyncGenerator<SearchEvent> {
  const primary = detectCarriersByOwnerCode(containerNumber)
  const order = getSearchOrder(containerNumber)
  const checked: CarrierId[] = []

  const emitProgress = (
    phase: 'prefix' | 'fanout' | 'done',
    currentCarrierName?: string,
  ): SearchEvent => ({
    type: 'progress',
    phase,
    currentCarrierName,
    checked: checked.map((id) => CARRIERS.find((c) => c.id === id)!.name),
    total: order.length,
  })

  if (primary.length > 0) {
    yield emitProgress(
      'prefix',
      primary.map((c) => c.name).join(', '),
    )

    for (const carrier of primary) {
      yield emitProgress('prefix', carrier.name)
      const hit = await runOne(carrier, containerNumber, checked)
      if (hit) {
        yield emitProgress('done')
        yield {
          type: 'result',
          ok: true,
          data: withMeta(hit, checked, true, 'prefix'),
        }
        return
      }
      await sleep(THROTTLE_MS)
    }
  }

  const remaining = order.filter((c) => !checked.includes(c.id))
  for (const carrier of remaining) {
    yield emitProgress('fanout', carrier.name)
    const hit = await runOne(carrier, containerNumber, checked)
    if (hit) {
      yield emitProgress('done')
      yield {
        type: 'result',
        ok: true,
        data: withMeta(hit, checked, primary.length > 0, 'fanout'),
      }
      return
    }
    await sleep(THROTTLE_MS)
  }

  yield emitProgress('done')
  yield {
    type: 'result',
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `מספר המכולה לא נמצא לאחר סריקת דפי המעקב של החברות (${order
        .map((c) => c.name)
        .join(', ')}). נא לוודא את המספר.`,
    },
  }
}

async function runOne(
  carrier: Carrier,
  containerNumber: string,
  checked: CarrierId[],
): Promise<Omit<ScrapeResult, 'searchMeta'> | null> {
  checked.push(carrier.id)
  const outcome = await scrapeCarrier(carrier, containerNumber)

  if (outcome.status === 'found') return outcome.data
  // blocked/error on one carrier: continue to next (do not abort whole search)
  return null
}

function withMeta(
  data: Omit<ScrapeResult, 'searchMeta'>,
  checked: CarrierId[],
  detectedFromPrefix: boolean,
  strategy: 'prefix' | 'fanout',
): ScrapeResult {
  return {
    ...data,
    searchMeta: {
      detectedFromPrefix,
      searchedCarrierIds: [...checked],
      strategy,
    },
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
