import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../../../shared/api'

const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2
const RADIUS = 96

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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RadarSvg({ axes }) {
  const rings = [0.25, 0.5, 0.75, 1]
  const n = axes?.length || 6
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
    <svg className="dash-vibe-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="گراف شخصیت مطالعاتی">
      {grid.map((pts, i) => (
        <polygon key={`ring-${i}`} points={pts} className="dash-vibe-ring" />
      ))}
      {spokes.map((spoke, i) => (
        <line key={`spoke-${i}`} x1={CX} y1={CY} x2={spoke.x} y2={spoke.y} className="dash-vibe-spoke" />
      ))}
      <polygon points={shape} className="dash-vibe-shape" />
      {spokes.map((spoke, i) => {
        const [lx, ly] = polar(i * step, RADIUS + 28)
        return (
          <text key={`lbl-${i}`} x={lx} y={ly} className="dash-vibe-axis-label" textAnchor="middle" dominantBaseline="middle">
            {spoke.label}
            <tspan x={lx} dy="1.15em" className="dash-vibe-axis-value">
              {spoke.value}٪
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}

export default function VibeRadar({ vibe: initialVibe }) {
  const [vibe, setVibe] = useState(initialVibe)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const axes = vibe?.axes || []
  const moods = vibe?.top_moods || []
  const logs = vibe?.changelog || []
  const status = vibe?.status || 'empty'

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
          <h2>گراف شخصیت و وایب</h2>
          <p>مثل اسپاتیفای؛ هر کتاب جدید مود مطالعاتی‌ات را جابه‌جا می‌کند.</p>
        </div>
        {status === 'ready' ? (
          <span className="dash-vibe-badge">{headline}</span>
        ) : null}
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
            <p>کتاب روی قفسه‌ات هست؛ با یک کلیک وایب را با GPT بساز.</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handleRefresh}>
              {busy ? 'در حال تحلیل…' : 'تحلیل وایب الان'}
            </button>
          </div>
        ) : null}

        {status === 'ready' ? (
          <div className="dash-vibe-grid">
            <div className="dash-vibe-chart-wrap">
              <RadarSvg axes={axes} />
            </div>

            <div className="dash-vibe-side">
              <blockquote className="dash-vibe-quote">
                <p>{vibe.quote || '—'}</p>
              </blockquote>

              {moods.length ? (
                <div className="dash-vibe-moods" aria-label="مودهای غالب">
                  {moods.map((mood) => (
                    <span key={mood.key} className="dash-vibe-mood-chip">
                      <b>{mood.value}٪</b> {mood.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="dash-vibe-log">
                <h3>لاگ تغییر وایب</h3>
                <p className="dash-vibe-log-hint">۵ تغییر اخیر · همهٔ تاریخچه ذخیره می‌شود</p>
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
                        {log.deltas?.length ? (
                          <div className="dash-vibe-deltas" aria-label="جزئیات تغییر مود">
                            {log.deltas.map((d) => (
                              <span
                                key={d.key}
                                className={`dash-vibe-delta ${d.delta > 0 ? 'is-up' : 'is-down'}`}
                              >
                                {d.label} {d.from}→{d.to}{' '}
                                <b>
                                  {d.delta > 0 ? '+' : ''}
                                  {d.delta}
                                </b>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="dash-vibe-log-empty">تغییر عددی محسوسی نبود.</p>
                        )}
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
