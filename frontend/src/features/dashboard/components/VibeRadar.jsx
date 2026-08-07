import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dashboardApi } from '../../../shared/api'
import { formatDate } from '../../../i18n/format'

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

function formatLogDate(iso) {
  if (!iso) return ''
  try {
    return formatDate(iso, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function RadarSvg({ axes, chartAria }) {
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
    <svg className="dash-vibe-svg" viewBox="-28 -28 316 316" role="img" aria-label={chartAria}>
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
  const { t } = useTranslation()
  const [vibe, setVibe] = useState(initialVibe)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const axes = vibe?.axes || []
  const logs = vibe?.changelog || []
  const status = vibe?.status || 'empty'
  const genreMix = vibe?.genre_mix || []

  const headline = useMemo(() => {
    if (status === 'ready' && vibe?.mood_label) return vibe.mood_label
    if (status === 'pending') return t('dashboard.vibe.pendingHeadline')
    return t('dashboard.vibe.emptyHeadline')
  }, [status, vibe?.mood_label, t])

  async function handleRefresh() {
    setBusy(true)
    setErr('')
    try {
      const res = await dashboardApi.refreshVibe()
      if (res?.vibe) setVibe(res.vibe)
    } catch (e) {
      setErr(e.message || t('dashboard.vibe.analyzeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dash-vibe section" aria-label={t('dashboard.vibe.aria')}>
      <div className="dash-vibe-head">
        <div className="section-head">
          <h2>{t('dashboard.vibe.title')}</h2>
          <p>{t('dashboard.vibe.subtitle')}</p>
        </div>
        {status === 'ready' && headline ? <span className="dash-vibe-badge">{headline}</span> : null}
      </div>

      <div className="dash-vibe-panel">
        {err ? <p className="form-errors">{err}</p> : null}

        {status === 'empty' ? (
          <div className="dash-vibe-empty">
            <p>{t('dashboard.vibe.emptyBody')}</p>
            <Link to="/books/new" className="btn btn-primary">
              {t('dashboard.vibe.addBook')}
            </Link>
          </div>
        ) : null}

        {status === 'pending' ? (
          <div className="dash-vibe-empty">
            <p>{t('dashboard.vibe.pendingBody')}</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handleRefresh}>
              {busy ? t('dashboard.vibe.analyzing') : t('dashboard.vibe.analyze')}
            </button>
          </div>
        ) : null}

        {status === 'ready' ? (
          <div className="dash-vibe-grid">
            <div className="dash-vibe-chart-wrap">
              <RadarSvg axes={axes} chartAria={t('dashboard.vibe.chartAria')} />
            </div>

            <div className="dash-vibe-side">
              {(vibe.current_genre || vibe.favorite_genre) && (
                <dl className="dash-vibe-genres">
                  {vibe.current_genre ? (
                    <div>
                      <dt>{t('dashboard.vibe.now')}</dt>
                      <dd>{vibe.current_genre}</dd>
                    </div>
                  ) : null}
                  {vibe.favorite_genre ? (
                    <div>
                      <dt>{t('dashboard.vibe.favorite')}</dt>
                      <dd>{vibe.favorite_genre}</dd>
                    </div>
                  ) : null}
                </dl>
              )}

              {genreMix.length > 0 ? (
                <ul className="dash-vibe-mix" aria-label={t('dashboard.vibe.genreMixAria')}>
                  {genreMix.slice(0, 3).map((g) => (
                    <li key={g.key}>
                      <span>{g.label}</span>
                      <b>{t('dashboard.vibe.percent', { value: g.value })}</b>
                    </li>
                  ))}
                </ul>
              ) : null}

              {vibe.quote ? <p className="dash-vibe-quote">{vibe.quote}</p> : null}

              <div className="dash-vibe-log">
                <h3>{t('dashboard.vibe.recentChanges')}</h3>
                {logs.length === 0 ? (
                  <p className="dash-vibe-log-empty">{t('dashboard.vibe.noLogs')}</p>
                ) : (
                  <ul>
                    {logs.map((log) => (
                      <li key={log.id}>
                        <div className="dash-vibe-log-meta">
                          <strong>{log.book_title || t('dashboard.vibe.bookFallback')}</strong>
                          <time dateTime={log.created_at}>{formatLogDate(log.created_at)}</time>
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
