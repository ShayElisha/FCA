import cors from 'cors'
import express from 'express'
import { closeBrowser } from './browser.js'
import { CARRIERS, type CarrierId } from './carriers.js'
import {
  isValidContainer,
  normalizeContainer,
  scrapeOneCarrier,
} from './handlers/scrapeOne.js'
import { searchAcrossCarriers } from './search.js'

const app = express()
const PORT = Number(process.env.PORT ?? 8787)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'local-scrape',
    message: 'Playwright scraping (compatible with Vercel /api/scrape)',
  })
})

/**
 * Single-carrier scrape — same contract as Vercel Serverless `/api/scrape`.
 */
app.post('/api/scrape', async (req, res) => {
  const containerNumber = normalizeContainer(req.body?.containerNumber)
  const carrierId = String(req.body?.carrierId ?? '') as CarrierId

  if (!isValidContainer(containerNumber)) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_CONTAINER_NUMBER',
        message:
          'מספר המכולה אינו תקין לפי תקן ISO 6346. הפורמט הנדרש: 4 אותיות ו-7 ספרות.',
      },
    })
    return
  }

  if (!CARRIERS.some((c) => c.id === carrierId)) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_CARRIER',
        message: 'חברת ספנות לא נתמכת.',
      },
    })
    return
  }

  try {
    const outcome = await scrapeOneCarrier(containerNumber, carrierId)

    if (outcome.status === 'found') {
      res.status(200).json({ ok: true, status: 'found', data: outcome.data })
      return
    }

    if (outcome.status === 'blocked' || outcome.status === 'error') {
      res.status(200).json({
        ok: true,
        status: outcome.status,
        details: outcome.details,
      })
      return
    }

    res.status(200).json({ ok: true, status: 'not_found' })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'אירעה תקלה בסריקת האתר. נסו שוב.',
        details: error instanceof Error ? error.message : String(error),
      },
    })
  }
})

/** Optional SSE multi-carrier (local helper). Frontend uses /api/scrape. */
app.post('/api/track', async (req, res) => {
  const containerNumber = normalizeContainer(req.body?.containerNumber)

  if (!isValidContainer(containerNumber)) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_CONTAINER_NUMBER',
        message:
          'מספר המכולה אינו תקין לפי תקן ISO 6346. הפורמט הנדרש: 4 אותיות ו-7 ספרות.',
      },
    })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  try {
    for await (const event of searchAcrossCarriers(containerNumber)) {
      send(event)
      if (event.type === 'result') break
    }
  } catch (error) {
    send({
      type: 'result',
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'אירעה תקלה בסריקת האתרים. נסו שוב.',
        details: error instanceof Error ? error.message : String(error),
      },
    })
  } finally {
    res.end()
  }
})

const server = app.listen(PORT, () => {
  console.log(`FCA scraper server on http://localhost:${PORT}`)
  console.log('Endpoints: POST /api/scrape , POST /api/track')
})

async function shutdown() {
  server.close()
  await closeBrowser()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
