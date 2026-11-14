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

type ScrapeApiResponse =
  | {
      ok: true
      status: 'found'
      data: Omit<ContainerTrackingResult, 'searchMeta'>
    }
  | { ok: true; status: 'not_found' | 'blocked' | 'error'; details?: string }
  | { ok: false; error: TrackingError }

const SCRAPER_BASE =
  import.meta.env.VITE_SCRAPER_URL?.replace(/\/$/, '') || ''

/** Parallel serverless invocations — biggest UX speed win */
const CONCURRENCY = Number(import.meta.env.VITE_SCRAPE_CONCURRENCY ?? 4)

/**
 * Fast multi-carrier search:
 * 1) Prefix carriers in parallel
 * 2) Fan-out in parallel batches; first hit wins
 */
export async function trackContainer(
  containerNumber: string,
  onProgress?: ProgressCallback,
): Promise<TrackResponse> {
  const primary = detectCarriersByOwnerCode(containerNumber)
  const order = getSearchOrder(containerNumber)
  const checked: CarrierId[] = []

  const report = (
    phase: SearchProgress['phase'],
    currentCarrierName?: string,
  ) => {
    onProgress?.({
      phase,
      currentCarrierName,
      checked: checked.map((id) => CARRIERS.find((c) => c.id === id)!.name),
      total: order.length,
    })
  }

  if (primary.length > 0) {
    report('prefix', primary.map((c) => c.name).join(', '))
    const hit = await raceCarriers(
      primary,
      containerNumber,
      checked,
      (names) => report('prefix', names),
    )
    if (hit) {
      report('done')
      return { ok: true, data: withMeta(hit, checked, true, 'prefix') }
    }
  }

  const remaining = order.filter((c) => !checked.includes(c.id))
  report('fanout', remaining.slice(0, CONCURRENCY).map((c) => c.name).join(', '))
  const hit = await raceCarriers(
    remaining,
    containerNumber,
    checked,
    (names) => report('fanout', names),
  )
  if (hit) {
    report('done')
    return {
      ok: true,
      data: withMeta(hit, checked, primary.length > 0, 'fanout'),
    }
  }

  report('done')
  return {
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `מספר המכולה לא נמצא לאחר סריקה מקבילית של החברות (${order
        .map((c) => c.name)
        .join(', ')}). נא לוודא את המספר.`,
    },
  }
}

async function raceCarriers(
  carriers: Carrier[],
  containerNumber: string,
  checked: CarrierId[],
  onBatch?: (names: string) => void,
): Promise<Omit<ContainerTrackingResult, 'searchMeta'> | null> {
  for (let i = 0; i < carriers.length; i += CONCURRENCY) {
    const batch = carriers.slice(i, i + CONCURRENCY)
    onBatch?.(batch.map((c) => c.name).join(', '))

    const results = await Promise.all(
      batch.map(async (carrier) => {
        checked.push(carrier.id)
        return scrapeCarrier(containerNumber, carrier.id)
      }),
    )

    const found = results.find((r) => r !== null) ?? null
    if (found) return found
  }
  return null
}

async function scrapeCarrier(
  containerNumber: string,
  carrierId: CarrierId,
): Promise<Omit<ContainerTrackingResult, 'searchMeta'> | null> {
  let response: Response
  try {
    response = await fetch(`${SCRAPER_BASE}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerNumber, carrierId }),
    })
  } catch {
    throw Object.assign(new Error('scraper unavailable'), {
      trackingError: {
        code: 'PROVIDER_UNAVAILABLE',
        message:
          'פונקציית הסריקה לא זמינה. בדקו שהפרויקט רץ על Vercel Serverless.',
      } satisfies TrackingError,
    })
  }

  if (response.status === 404 || response.status === 405) {
    throw Object.assign(new Error('track endpoint missing'), {
      trackingError: {
        code: 'PROVIDER_UNAVAILABLE',
        message: `נתיב /api/track החזיר ${response.status}. רעננו את העמוד אחרי דיפלוי.`,
      } satisfies TrackingError,
    })
  }

  const json = (await response.json()) as ScrapeApiResponse

  if (!json.ok) {
    if (json.error.code === 'INVALID_CONTAINER_NUMBER') {
      throw Object.assign(new Error(json.error.message), {
        trackingError: json.error,
      })
    }
    return null
  }

  if (json.status === 'found') {
    return { ...json.data, source: 'scrape' }
  }

  // Surface block reason for the primary carrier in progress UIs via details
  if (json.status === 'blocked' && json.details) {
    console.warn('carrier blocked', carrierId, json.details)
  }

  return null
}

function withMeta(
  data: Omit<ContainerTrackingResult, 'searchMeta'>,
  checked: CarrierId[],
  detectedFromPrefix: boolean,
  strategy: 'prefix' | 'fanout',
): ContainerTrackingResult {
  return {
    ...data,
    source: 'scrape',
    searchMeta: {
      detectedFromPrefix,
      searchedCarrierIds: [...checked],
      strategy,
    },
  }
}

export async function trackContainerSafe(
  containerNumber: string,
  onProgress?: ProgressCallback,
): Promise<TrackResponse> {
  try {
    return await trackContainer(containerNumber, onProgress)
  } catch (error) {
    const trackingError = (error as { trackingError?: TrackingError })
      .trackingError
    if (trackingError) return { ok: false, error: trackingError }
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'אירעה תקלה פנימית. נסו שוב.',
      },
    }
  }
}
