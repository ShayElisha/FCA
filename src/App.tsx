import { useState } from 'react'
import type { FormEvent } from 'react'
import { validateContainerNumber } from './iso6346'
import { trackContainer } from './track'
import type { ContainerTrackingResult } from './types'

export default function App() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [result, setResult] = useState<ContainerTrackingResult | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setApiError(null)
    setResult(null)

    const validation = validateContainerNumber(input)
    if (!validation.ok) {
      setFieldError(validation.message)
      return
    }

    setFieldError(null)
    setLoading(true)

    try {
      const response = await trackContainer(validation.containerNumber)
      if (!response.ok) {
        setApiError(response.error.message)
        return
      }
      setResult(response.data)
    } catch {
      setApiError('אירעה תקלה פנימית. נסו שוב.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden="true" />

      <header className="brand">
        <p className="brand-mark">FCA</p>
        <h1>מעקב מכולות MSC</h1>
        <p className="lede">
          הזינו מספר מכולה לקבלת סטטוס ומועד הגעה צפוי לנמלי ישראל.
        </p>
      </header>

      <main>
        <form className="search" onSubmit={onSubmit} noValidate>
          <label htmlFor="container">מספר מכולה</label>
          <div className="row">
            <input
              id="container"
              name="container"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="MSCU1234566"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setFieldError(null)
              }}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'container-error' : 'container-help'}
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'בודק…' : 'בדוק סטטוס'}
            </button>
          </div>
          <p id="container-help" className="help">
            תקן ISO 6346 · 4 אותיות ו-7 ספרות
          </p>
          {fieldError && (
            <p id="container-error" className="error" role="alert">
              {fieldError}
            </p>
          )}
        </form>

        {apiError && (
          <div className="banner error-banner" role="alert">
            {apiError}
          </div>
        )}

        {result && <ResultCard data={result} />}
      </main>

      <footer>
        <p>
          ממשק MVP לפי אפיון המערכת. שכבת השליפה מ-MSC תחובר בשלב הבא.
        </p>
      </footer>
    </div>
  )
}

function ResultCard({ data }: { data: ContainerTrackingResult }) {
  const israelLabel =
    data.israelPort === 'Unknown'
      ? 'לא זוהה יעד ישראלי'
      : data.israelPort === 'Ashdod'
        ? 'נמל אשדוד'
        : 'נמל חיפה'

  const etaLabel = data.eta
    ? new Date(data.eta).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'ETA לא זמין'

  return (
    <section className="result" aria-live="polite">
      <div className="result-head">
        <h2>תוצאת מעקב</h2>
        {data.demo && <span className="badge">מצב הדגמה</span>}
      </div>

      <dl>
        <div>
          <dt>מספר מכולה</dt>
          <dd>{data.containerNumber}</dd>
        </div>
        <div>
          <dt>אונייה וקו הפלגה</dt>
          <dd>
            {data.vesselName ?? '—'}
            {data.voyageNumber ? ` · ${data.voyageNumber}` : ''}
          </dd>
        </div>
        <div>
          <dt>יעד סופי בישראל</dt>
          <dd>{israelLabel}</dd>
        </div>
        <div>
          <dt>תאריך הגעה צפוי (ETA)</dt>
          <dd className="eta">{etaLabel}</dd>
        </div>
        <div>
          <dt>סטטוס נוכחי</dt>
          <dd>
            {data.status}
            {data.currentLocation ? ` · ${data.currentLocation}` : ''}
          </dd>
        </div>
        <div>
          <dt>זמן עדכון</dt>
          <dd>
            {new Date(data.retrievedAt).toLocaleString('he-IL', {
              timeZone: 'Asia/Jerusalem',
            })}
          </dd>
        </div>
      </dl>
    </section>
  )
}
