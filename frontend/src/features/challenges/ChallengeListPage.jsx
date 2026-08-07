import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { challengesApi } from '../../shared/api'
import { labelFromCode } from '../../i18n/labels'
import { formatDate } from '../../i18n/format'

export default function ChallengeListPage() {
  const { t } = useTranslation()
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
  if (!data) return <p>{t('app.loading')}</p>

  return (
    <div className="page-challenges">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t('challenges.list.eyebrow')}</p>
          <h1>{t('challenges.list.title')}</h1>
          <div className="cluster">
            <Link to="/challenges/new" className="btn btn-primary btn-lg">
              {t('challenges.list.new')}
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <strong>{data.total_count}</strong>
            <span>{t('challenges.list.statTotal')}</span>
          </div>
          <div>
            <strong>{data.active_count}</strong>
            <span>{t('challenges.list.statActive')}</span>
          </div>
          <div>
            <strong>{data.completed_count}</strong>
            <span>{t('challenges.list.statCompleted')}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="filter-bar">
          <button type="button" className={`chip${!active ? ' is-active' : ''}`} onClick={() => setStatus('')}>
            {t('app.all')}
          </button>
          {data.statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`chip${active === s.value ? ' is-active' : ''}`}
              onClick={() => setStatus(s.value)}
            >
              {labelFromCode('challenges.status', s.value, s.label)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{t('challenges.list.emptyTitle')}</h3>
            <Link to="/challenges/new" className="btn btn-secondary">
              {t('challenges.list.create')}
            </Link>
          </div>
        ) : (
          <div className="challenge-grid">
            {filtered.map((ch) => (
              <Link key={ch.id} to={`/challenges/${ch.id}`} className="challenge-tile">
                <div className="challenge-tile-head">
                  <h3>{ch.title}</h3>
                  <span className={`status status-challenge-${ch.status}`}>
                    {labelFromCode('challenges.status', ch.status, ch.status_display)}
                  </span>
                </div>
                <p className="challenge-meta">
                  {t('challenges.periodLabel', {
                    duration: ch.duration,
                    unit: labelFromCode('challenges.periodUnit', ch.period_unit, ch.period_unit_display),
                  })}{' '}
                  ·{' '}
                  {t('challenges.dateRange', {
                    start: formatDate(ch.starts_on),
                    end: formatDate(ch.ends_on),
                  })}
                </p>
                <div className="dual-progress">
                  <div>
                    <span>{t('challenges.list.timePercent', { percent: ch.progress.time_percent })}</span>
                    <div className="progress progress-time">
                      <span style={{ width: `${ch.progress.time_percent}%` }} />
                    </div>
                  </div>
                  <div>
                    <span>
                      {t('challenges.list.completionPercent', { percent: ch.progress.completion_percent })}
                    </span>
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
