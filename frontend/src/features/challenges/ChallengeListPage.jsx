import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { challengesApi } from '../../shared/api'

export default function ChallengeListPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const active = params.get('status') || ''

  useEffect(() => {
    challengesApi
      .list()
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    if (!active) return data.results
    return data.results.filter((c) => c.status === active)
  }, [data, active])

  const setStatus = (status) => {
    const next = new URLSearchParams(params)
    if (status) next.set('status', status)
    else next.delete('status')
    setParams(next, { replace: true })
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!data) return <p>در حال بارگذاری…</p>

  return (
    <div className="page-challenges">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">چالش مطالعه</p>
          <h1>هدف‌هایت را دنبال کن</h1>
          <div className="cluster">
            <Link to="/challenges/new" className="btn btn-primary btn-lg">
              چالش جدید
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <strong>{data.total_count}</strong>
            <span>کل</span>
          </div>
          <div>
            <strong>{data.active_count}</strong>
            <span>فعال</span>
          </div>
          <div>
            <strong>{data.completed_count}</strong>
            <span>تمام‌شده</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="filter-bar">
          <button type="button" className={`chip${!active ? ' is-active' : ''}`} onClick={() => setStatus('')}>
            همه
          </button>
          {data.statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`chip${active === s.value ? ' is-active' : ''}`}
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>چالشی نیست</h3>
            <Link to="/challenges/new" className="btn btn-secondary">
              ساخت چالش
            </Link>
          </div>
        ) : (
          <div className="challenge-grid">
            {filtered.map((ch) => (
              <Link key={ch.id} to={`/challenges/${ch.id}`} className="challenge-tile">
                <div className="challenge-tile-head">
                  <h3>{ch.title}</h3>
                  <span className={`status status-challenge-${ch.status}`}>{ch.status_display}</span>
                </div>
                <p className="challenge-meta">
                  {ch.period_label} · {ch.starts_on} تا {ch.ends_on}
                </p>
                <div className="dual-progress">
                  <div>
                    <span>زمان {ch.progress.time_percent}%</span>
                    <div className="progress progress-time">
                      <span style={{ width: `${ch.progress.time_percent}%` }} />
                    </div>
                  </div>
                  <div>
                    <span>تکمیل {ch.progress.completion_percent}%</span>
                    <div className="progress progress-done">
                      <span style={{ width: `${ch.progress.completion_percent}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
