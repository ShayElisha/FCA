import type {
  ContainerTrackingResult,
  SearchProgress,
  TrackingError,
} from './types'

export type TrackResponse =
  | { ok: true; data: ContainerTrackingResult }
  | { ok: false; error: TrackingError }

export type ProgressCallback = (progress: SearchProgress) => void

const SCRAPER_BASE =
  import.meta.env.VITE_SCRAPER_URL?.replace(/\/$/, '') || ''

/**
 * Calls the local Playwright scraping server (SSE).
 * No third-party / carrier APIs — only browser scraping of public track pages.
 */
export async function trackContainer(
  containerNumber: string,
  onProgress?: ProgressCallback,
): Promise<TrackResponse> {
  let response: Response
  try {
    response = await fetch(`${SCRAPER_BASE}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ containerNumber }),
    })
  } catch {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message:
          'שרת הסריקה לא זמין. הפעילו אותו מקומית עם npm run server (Playwright — בלי API של חברות ספנות).',
      },
    }
  }

  if (!response.ok || !response.body) {
    if (response.headers.get('content-type')?.includes('application/json')) {
      const json = (await response.json()) as TrackResponse
      return json
    }
    return {
      ok: false,
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'שרת הסריקה החזיר שגיאה. בדקו שהוא רץ (npm run server).',
      },
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: TrackResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const line = chunk
        .split('\n')
        .find((l) => l.startsWith('data:'))
      if (!line) continue
      const payload = JSON.parse(line.slice(5).trim()) as
        | {
            type: 'progress'
            phase: SearchProgress['phase']
            currentCarrierName?: string
            checked: string[]
            total: number
          }
        | ({ type: 'result' } & TrackResponse)

      if (payload.type === 'progress') {
        onProgress?.({
          phase: payload.phase,
          currentCarrierName: payload.currentCarrierName,
          checked: payload.checked,
          total: payload.total,
        })
      } else if (payload.type === 'result') {
        finalResult = payload.ok
          ? { ok: true, data: payload.data }
          : { ok: false, error: payload.error }
      }
    }
  }

  return (
    finalResult ?? {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'הסריקה הסתיימה ללא תוצאה. נסו שוב.',
      },
    }
  )
}
