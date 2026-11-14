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

type ScrapeOutcome =
  | { kind: 'found'; data: Omit<ContainerTrackingResult, 'searchMeta'> }
  | { kind: 'not_found' }
  | { kind: 'blocked'; details?: string }
  | { kind: 'error'; details?: string }

const SCRAPER_BASE =
  import.meta.env.VITE_SCRAPER_URL?.replace(/\/$/, '') || ''

const CONCURRENCY = Number(import.meta.env.VITE_SCRAPE_CONCURRENCY ?? 4)

const BLOCKED_MSG =
  'הסריקה נחסמה כרגע. ודאו ש־npm run dev ו־ngrok רצים, רעננו את העמוד, ונסו שוב. ' +
  'אם זה ממשיך — בדקו ב־/api/health ש־readyForMsc=true.'

/**
 * Multi-carrier search with accurate blocked vs not-found handling.
 */
export async function trackContainer(
  containerNumber: string,
  onProgress?: ProgressCallback,
): Promise<TrackResponse> {
  const primary = detectCarriersByOwnerCode(containerNumber)
  const order = getSearchOrder(containerNumber)
  const checked: CarrierId[] = []
  let blockedCount = 0
  let notFoundCount = 0
  let errorCount = 0

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

  const tally = (outcomes: ScrapeOutcome[]) => {
    for (const o of outcomes) {
      if (o.kind === 'blocked') blockedCount += 1
      else if (o.kind === 'not_found') notFoundCount += 1
      else if (o.kind === 'error') errorCount += 1
    }
  }

  if (primary.length > 0) {
    report('prefix', primary.map((c) => c.name).join(', '))
    const { hit, outcomes } = await raceCarriers(
      primary,
      containerNumber,
      checked,
      (names) => report('prefix', names),
    )
    tally(outcomes)

    if (hit) {
      report('done')
      return { ok: true, data: withMeta(hit, checked, true, 'prefix') }
    }

    // Prefix carrier blocked (e.g. MSC on Vercel) — stop early with clear guidance
    const primaryBlocked = outcomes.every(
      (o) => o.kind === 'blocked' || o.kind === 'error',
    )
    if (primaryBlocked && outcomes.length > 0) {
      report('done')
      const names = primary.map((c) => c.name).join(', ')
      return {
        ok: false,
        error: {
          code: 'SOURCE_BLOCKED',
          message: `${names} חסמו את הסריקה האוטומטית. ${BLOCKED_MSG}`,
        },
      }
    }
  }

  const remaining = order.filter((c) => !checked.includes(c.id))
  report(
    'fanout',
    remaining.slice(0, CONCURRENCY).map((c) => c.name).join(', '),
  )
  const { hit, outcomes } = await raceCarriers(
    remaining,
    containerNumber,
    checked,
    (names) => report('fanout', names),
  )
  tally(outcomes)

  if (hit) {
    report('done')
    return {
      ok: true,
      data: withMeta(hit, checked, primary.length > 0, 'fanout'),
    }
  }

  report('done')

  const attempted = blockedCount + notFoundCount + errorCount
  if (attempted > 0 && blockedCount + errorCount >= Math.ceil(attempted * 0.6)) {
    return {
      ok: false,
      error: {
        code: 'SOURCE_BLOCKED',
        message: BLOCKED_MSG,
      },
    }
  }

  return {
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `מספר המכולה לא נמצא לאחר סריקה של החברות (${checked
        .map((id) => CARRIERS.find((c) => c.id === id)!.name)
        .join(', ')}). נא לוודא את המספר.`,
    },
  }
}

async function raceCarriers(
  carriers: Carrier[],
  containerNumber: string,
  checked: CarrierId[],
  onBatch?: (names: string) => void,
): Promise<{
  hit: Omit<ContainerTrackingResult, 'searchMeta'> | null
  outcomes: ScrapeOutcome[]
}> {
  const outcomes: ScrapeOutcome[] = []

  for (let i = 0; i < carriers.length; i += CONCURRENCY) {
    const batch = carriers.slice(i, i + CONCURRENCY)
    onBatch?.(batch.map((c) => c.name).join(', '))

    const batchOutcomes = await Promise.all(
      batch.map(async (carrier) => {
        checked.push(carrier.id)
        return scrapeCarrier(containerNumber, carrier.id)
      }),
    )
    outcomes.push(...batchOutcomes)

    const found = batchOutcomes.find((o) => o.kind === 'found')
    if (found && found.kind === 'found') {
      return { hit: found.data, outcomes }
    }
  }

  return { hit: null, outcomes }
}

async function scrapeCarrier(
  containerNumber: string,
  carrierId: CarrierId,
  attempt = 1,
): Promise<ScrapeOutcome> {
  let response: Response
  try {
    response = await fetch(`${SCRAPER_BASE}/api/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ containerNumber, carrierId }),
    })
  } catch {
    throw Object.assign(new Error('scraper unavailable'), {
      trackingError: {
        code: 'PROVIDER_UNAVAILABLE',
        message:
          'שרת הסריקה לא זמין. השאירו npm run dev + ngrok דולקים.',
      } satisfies TrackingError,
    })
  }

  if (response.status === 404 || response.status === 405) {
    throw Object.assign(new Error('track endpoint missing'), {
      trackingError: {
        code: 'PROVIDER_UNAVAILABLE',
        message: `נתיב /api/track החזיר ${response.status}. רעננו קשיח את העמוד.`,
      } satisfies TrackingError,
    })
  }

  let json: ScrapeApiResponse
  try {
    json = (await response.json()) as ScrapeApiResponse
  } catch {
    return { kind: 'error', details: 'Invalid JSON from /api/track' }
  }

  if (!json.ok) {
    if (json.error.code === 'INVALID_CONTAINER_NUMBER') {
      throw Object.assign(new Error(json.error.message), {
        trackingError: json.error,
      })
    }
    // Upstream Chrome host temporarily down
    if (json.error.code === 'PROVIDER_UNAVAILABLE' && attempt < 2) {
      await delay(1200)
      return scrapeCarrier(containerNumber, carrierId, attempt + 1)
    }
    return { kind: 'error', details: json.error.message }
  }

  if (json.status === 'found') {
    return { kind: 'found', data: { ...json.data, source: 'scrape' } }
  }

  if (json.status === 'blocked') {
    // One retry — transient Akamai / cold start noise
    if (attempt < 2) {
      await delay(1500)
      return scrapeCarrier(containerNumber, carrierId, attempt + 1)
    }
    return { kind: 'blocked', details: json.details }
  }

  if (json.status === 'error') {
    if (attempt < 2) {
      await delay(1000)
      return scrapeCarrier(containerNumber, carrierId, attempt + 1)
    }
    return { kind: 'error', details: json.details }
  }

  return { kind: 'not_found' }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
