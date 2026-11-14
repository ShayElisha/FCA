import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const upstream = process.env.SCRAPER_UPSTREAM_URL?.replace(/\/$/, '') || null
  let upstreamOk: boolean | null = null
  let upstreamMode: string | null = null
  let upstreamError: string | null = null

  if (upstream) {
    try {
      const r = await fetch(`${upstream}/api/health`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: AbortSignal.timeout(8000),
      })
      const json = (await r.json().catch(() => null)) as {
        ok?: boolean
        mode?: string
      } | null
      upstreamOk = r.ok && Boolean(json?.ok)
      upstreamMode = json?.mode ?? null
      if (!upstreamOk) upstreamError = `HTTP ${r.status}`
    } catch (error) {
      upstreamOk = false
      upstreamError = error instanceof Error ? error.message : String(error)
    }
  }

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    ok: true,
    mode: upstream ? 'proxy-to-chrome-host' : 'vercel-serverless-scrape',
    upstreamConfigured: Boolean(upstream),
    upstreamOk,
    upstreamMode,
    upstreamError,
    readyForMsc: Boolean(upstream && upstreamOk),
  })
}
