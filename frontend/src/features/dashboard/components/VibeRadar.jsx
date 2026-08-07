import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../../../shared/api'

const SIZE = 260
const CX = SIZE / 2
const CY = SIZE / 2
const RADIUS = 78

function polar(angleDeg, r) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
}

function polygonPoints(axes, max = 100) {
  if (!axes?.length) return ''
  const step = 360 / axes.length
  return axes
    .map((axis, i) => {
      const value = Math.max(0, Math.min(max, Number(axis.value) || 0))
      const [x, y] = polar(i * step, (value / max) * RADIUS)
      return `${x},${y}`
    })
    .join(' ')
}

function formatFaDate(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RadarSvg({ axes }) {
  const rings = [0.33, 0.66, 1]
  const n = axes?.length || 8
  const step = 360 / n
  const grid = rings.map((ratio) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const [x, y] = polar(i * step, RADIUS * ratio)
      return `${x},${y}`
    }).join(' ')
    return pts
  })
  const spokes = Array.from({ length: n }, (_, i) => {
    const [x, y] = polar(i * step, RADIUS)
    return { x, y, label: axes?.[i]?.label || '', value: axes?.[i]?.value ?? 0 }
  })
  const shape = polygonPoints(axes)

  return (
    <svg className="dash-vibe-svg" viewBox="-28 -28 316 316" role="img" aria-label="گراف شخصیت مطالعاتی">
      {grid.map((pts, i) => (
        <polygon key={`ring-${i}`} points={pts} className="dash-vibe-ring" />
      ))}
      {spokes.map((spoke, i) => (
        <line key={`spoke-${i}`} x1={CX} y1={CY} x2={spoke.x} y2={spoke.y} className="dash-vibe-spoke" />
      ))}
      <polygon points={shape} className="dash-vibe-shape" />
      {spokes.map((spoke, i) => {
        const [lx, ly] = polar(i * step, RADIUS + 26)
        return (
          <text key={`lbl-${i}`} x={lx} y={ly} className="dash-vibe-axis-label" textAnchor="middle" dominantBaseline="middle">
            {spoke.label}
          </text>
        )
      })}
    </svg>
  )
}

function DeltaInline({ deltas }) {
  if (!deltas?.length) return null
  return (
    <span className="dash-vibe-deltas">
      {deltas.map((d) => (
        <span key={d.key} className={`dash-vibe-delta ${d.delta > 0 ? 'is-up' : 'is-down'}`}>
          {d.label}
          <b>
            {d.delta > 0 ? '+' : ''}
            {d.delta}
          </b>
        </span>
      ))}
    </span>
  )
}

export default function VibeRadar({ vibe: initialVibe }) {
  const [vibe, setVibe] = useState(initialVibe)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const axes = vibe?.axes || []
  const logs = vibe?.changelog || []
  const status = vibe?.status || 'empty'
  const genreMix = vibe?.genre_mix || []

  const headline = useMemo(() => {
    if (status === 'ready' && vibe?.mood_label) return vibe.mood_label
    if (status === 'pending') return 'در صف تحلیل…'
    return 'هنوز شکل نگرفته'
  }, [status, vibe?.mood_label])

  async function handleRefresh() {
    setBusy(true)
    setErr('')
    try {
      const res = await dashboardApi.refreshVibe()
      if (res?.vibe) setVibe(res.vibe)
    } catch (e) {
      setErr(e.message || 'تحلیل وایب ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dash-vibe section" aria-label="گراف شخصیت و وایب مطالعاتی">
      <div className="dash-vibe-head">
        <div className="section-head">
          <h2>گراف شخصیت</h2>
          <p>مود و ژانر مطالعاتی‌ات با هر کتاب جابه‌جا می‌شود.</p>
        </div>
        {status === 'ready' && headline ? <span className="dash-vibe-badge">{headline}</span> : null}
      </div>

      <div className="dash-vibe-panel">
        {err ? <p className="form-errors">{err}</p> : null}

        {status === 'empty' ? (
          <div className="dash-vibe-empty">
            <p>اولین کتاب را به قفسه اضافه کن تا رادار شخصیتت زنده شود.</p>
            <Link to="/books/new" className="btn btn-primary">
              افزودن کتاب
            </Link>
          </div>
        ) : null}

        {status === 'pending' ? (
          <div className="dash-vibe-empty">
            <p>کتاب روی قفسه‌ات هست؛ با یک کلیک وایب را بساز.</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handleRefresh}>
              {busy ? 'در حال تحلیل…' : 'تحلیل وایب'}
            </button>
          </div>
        ) : null}

        {status === 'ready' ? (
          <div className="dash-vibe-grid">
            <div className="dash-vibe-chart-wrap">
              <RadarSvg axes={axes} />
            </div>

            <div className="dash-vibe-side">
              {(vibe.current_genre || vibe.favorite_genre) && (
                <dl className="dash-vibe-genres">
                  {vibe.current_genre ? (
                    <div>
                      <dt>الان</dt>
                      <dd>{vibe.current_genre}</dd>
                    </div>
                  ) : null}
                  {vibe.favorite_genre ? (
                    <div>
                      <dt>محبوب</dt>
                      <dd>{vibe.favorite_genre}</dd>
                    </div>
                  ) : null}
                </dl>
              )}

              {genreMix.length > 0 ? (
                <ul className="dash-vibe-mix" aria-label="ترکیب ژانر">
                  {genreMix.slice(0, 3).map((g) => (
                    <li key={g.key}>
                      <span>{g.label}</span>
                      <b>{g.value}٪</b>
                    </li>
                  ))}
                </ul>
              ) : null}

              {vibe.quote ? <p className="dash-vibe-quote">{vibe.quote}</p> : null}

              <div className="dash-vibe-log">
                <h3>تغییرات اخیر</h3>
                {logs.length === 0 ? (
                  <p className="dash-vibe-log-empty">هنوز لاگی نیست.</p>
                ) : (
                  <ul>
                    {logs.map((log) => (
                      <li key={log.id}>
                        <div className="dash-vibe-log-meta">
                          <strong>{log.book_title || 'کتاب'}</strong>
                          <time dateTime={log.created_at}>{formatFaDate(log.created_at)}</time>
                        </div>
                        <p>{log.change_summary}</p>
                        <DeltaInline deltas={log.deltas} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
