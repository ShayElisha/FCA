import {
  CARRIERS,
  detectCarriersByOwnerCode,
  getSearchOrder,
  type Carrier,
  type CarrierId,
} from './carriers.js'
import { scrapeCarrier } from './scrapers/index.js'
import type { ScrapeResult, SearchEvent } from './types.js'

const THROTTLE_MS = Number(
  process.env.SCRAPE_THROTTLE_MS ?? (process.env.VERCEL ? 0 : 200),
)
const CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY ?? 3)

/**
 * Multi-carrier search with parallel batches (local SSE / multi mode).
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
    yield emitProgress('prefix', primary.map((c) => c.name).join(', '))
    const hit = await runBatch(primary, containerNumber, checked)
    if (hit) {
      yield emitProgress('done')
      yield {
        type: 'result',
        ok: true,
        data: withMeta(hit, checked, true, 'prefix'),
      }
      return
    }
    if (THROTTLE_MS) await sleep(THROTTLE_MS)
  }

  const remaining = order.filter((c) => !checked.includes(c.id))
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY)
    yield emitProgress('fanout', batch.map((c) => c.name).join(', '))
    const hit = await runBatch(batch, containerNumber, checked)
    if (hit) {
      yield emitProgress('done')
      yield {
        type: 'result',
        ok: true,
        data: withMeta(hit, checked, primary.length > 0, 'fanout'),
      }
      return
    }
    if (THROTTLE_MS) await sleep(THROTTLE_MS)
  }

  yield emitProgress('done')
  yield {
    type: 'result',
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `מספר המכולה לא נמצא לאחר סריקה מקבילית של החברות (${order
        .map((c) => c.name)
        .join(', ')}). נא לוודא את המספר.`,
    },
  }
}

async function runBatch(
  carriers: Carrier[],
  containerNumber: string,
  checked: CarrierId[],
): Promise<Omit<ScrapeResult, 'searchMeta'> | null> {
  const outcomes = await Promise.all(
    carriers.map(async (carrier) => {
      checked.push(carrier.id)
      const outcome = await scrapeCarrier(carrier, containerNumber)
      return outcome.status === 'found' ? outcome.data : null
    }),
  )
  return outcomes.find((r) => r !== null) ?? null
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
