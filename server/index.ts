import cors from 'cors'
import express from 'express'
import { closeBrowser } from './browser.js'
import { searchAcrossCarriers } from './search.js'

const app = express()
const PORT = Number(process.env.PORT ?? 8787)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'scrape',
    message: 'Browser scraping server (no carrier APIs)',
  })
})

/**
 * SSE stream: progress events + final result.
 * Body: { containerNumber: string }
 */
app.post('/api/track', async (req, res) => {
  const containerNumber = String(req.body?.containerNumber ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')

  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(containerNumber)) {
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
  console.log('Mode: Playwright page scraping (no carrier APIs)')
})

async function shutdown() {
  server.close()
  await closeBrowser()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
