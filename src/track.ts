import {
  CARRIERS,
  detectCarriersByOwnerCode,
  getSearchOrder,
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

/**
 * Multi-carrier search via Vercel Serverless `POST /api/track` (one carrier per call).
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
    for (const carrier of primary) {
      report('prefix', carrier.name)
      const hit = await scrapeCarrier(containerNumber, carrier.id, checked)
      if (hit) {
        report('done')
        return {
          ok: true,
          data: withMeta(hit, checked, true, 'prefix'),
        }
      }
    }
  }

  const remaining = order.filter((c) => !checked.includes(c.id))
  for (const carrier of remaining) {
    report('fanout', carrier.name)
    const hit = await scrapeCarrier(containerNumber, carrier.id, checked)
    if (hit) {
      report('done')
      return {
        ok: true,
        data: withMeta(hit, checked, primary.length > 0, 'fanout'),
      }
    }
  }

  report('done')
  return {
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `מספר המכולה לא נמצא לאחר סריקת דפי המעקב של החברות (${order
        .map((c) => c.name)
        .join(', ')}). נא לוודא את המספר.`,
    },
  }
}

async function scrapeCarrier(
  containerNumber: string,
  carrierId: CarrierId,
  checked: CarrierId[],
): Promise<Omit<ContainerTrackingResult, 'searchMeta'> | null> {
  checked.push(carrierId)

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
    return {
      ...json.data,
      source: 'scrape',
    }
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
