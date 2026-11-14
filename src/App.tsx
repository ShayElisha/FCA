import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CARRIERS, detectCarriersByOwnerCode } from './carriers'
import { normalizeContainerNumber, validateContainerNumber } from './iso6346'
import { trackContainerSafe } from './track'
import type { ContainerTrackingResult, SearchProgress } from './types'

export default function App() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [result, setResult] = useState<ContainerTrackingResult | null>(null)
  const [progress, setProgress] = useState<SearchProgress | null>(null)

  const liveHint = useMemo(() => {
    const normalized = normalizeContainerNumber(input)
    if (normalized.length < 3) return null
    const detected = detectCarriersByOwnerCode(normalized)
    if (detected.length === 0) {
      return 'קידומת לא מזוהה — יבוצע חיפוש בדפי המעקב של כל החברות'
    }
    return `זוהתה קידומת של ${detected.map((c) => c.name).join(' / ')} · אם לא יימצא — סריקה של שאר האתרים`
  }, [input])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setApiError(null)
    setResult(null)
    setProgress(null)

    const validation = validateContainerNumber(input)
    if (!validation.ok) {
      setFieldError(validation.message)
      return
    }

    setFieldError(null)
    setLoading(true)

    try {
      const response = await trackContainerSafe(
        validation.containerNumber,
        setProgress,
      )
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
        <h1>מעקב מכולות רב־חברתי</h1>
        <p className="lede">
          הזינו מספר מכולה לחיפוש באתרי המעקב. ל־MSC מומלץ להריץ מקומית עם
          Google Chrome (<code>npm run dev</code>) — ב־Vercel אתרים רבים חוסמים
          סריקה אוטומטית.
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
              aria-describedby={
                fieldError ? 'container-error' : 'container-help'
              }
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'סריקה מקבילית…' : 'חפש בכל החברות'}
            </button>
          </div>
          <p id="container-help" className="help">
            ISO 6346 · סריקת דפי מעקב של {CARRIERS.length} חברות
          </p>
          {liveHint && !fieldError && <p className="hint">{liveHint}</p>}
          {fieldError && (
            <p id="container-error" className="error" role="alert">
              {fieldError}
            </p>
          )}
        </form>

        <CarrierStrip />

        {loading && progress && <SearchStatus progress={progress} />}

        {apiError && (
          <div className="banner error-banner" role="alert">
            {apiError}
          </div>
        )}

        {result && <ResultCard data={result} />}
      </main>

      <footer>
        <p>
          MSC על Vercel עלול להיחסם · להרצה אמינה: npm run dev עם Chrome מקומי.
        </p>
      </footer>
    </div>
  )
}

function CarrierStrip() {
  return (
    <section className="carriers" aria-label="חברות ספנות נתמכות">
      <p className="carriers-label">אתרים בסריקה</p>
      <ul>
        {CARRIERS.map((carrier) => (
          <li key={carrier.id}>{carrier.name}</li>
        ))}
      </ul>
    </section>
  )
}

function SearchStatus({ progress }: { progress: SearchProgress }) {
  const phaseLabel =
    progress.phase === 'prefix'
      ? 'סריקה מקבילית לפי קידומת'
      : progress.phase === 'fanout'
        ? 'לא נמצא בקידומת — סריקה מקבילית לשאר'
        : 'מסיים'

  return (
    <div className="banner progress-banner" aria-live="polite">
      <strong>{phaseLabel}</strong>
      {progress.currentCarrierName && (
        <span> · כעת: {progress.currentCarrierName}</span>
      )}
      <div className="progress-meta">
        נסרקו {progress.checked.length}/{progress.total}
        {progress.checked.length > 0 && (
          <> · {progress.checked.slice(-4).join(', ')}</>
        )}
      </div>
    </div>
  )
}

function ResultCard({ data }: { data: ContainerTrackingResult }) {
  const israelLabel =
    data.israelPort === 'Unknown'
      ? data.destinationPort
        ? `${data.destinationPort} (לא יעד ישראלי)`
        : 'לא זוהה יעד ישראלי'
      : data.israelPort === 'Ashdod'
        ? 'נמל אשדוד'
        : 'נמל חיפה'

  const etaLabel = data.eta
    ? new Date(data.eta).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : data.etaRaw || 'ETA לא זמין בעמוד'

  const strategyLabel =
    data.searchMeta.strategy === 'prefix'
      ? 'נמצא באתר שזוהה לפי קידומת'
      : 'נמצא לאחר סריקה מורחבת בין האתרים'

  return (
    <section className="result" aria-live="polite">
      <div className="result-head">
        <h2>תוצאת מעקב</h2>
        <div className="badges">
          <span className="badge carrier">{data.carrierName}</span>
          <span className="badge">סריקת אתר</span>
        </div>
      </div>

      <p className="strategy">{strategyLabel}</p>

      <dl>
        <div>
          <dt>מספר מכולה</dt>
          <dd>{data.containerNumber}</dd>
        </div>
        <div>
          <dt>חברת ספנות</dt>
          <dd>{data.carrierName}</dd>
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
          <dt>אתרים שנסרקו</dt>
          <dd>{data.searchMeta.searchedCarrierIds.length}</dd>
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
