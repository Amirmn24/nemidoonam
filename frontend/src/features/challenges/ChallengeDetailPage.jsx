import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { challengesApi } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import { labelFromCode } from '../../i18n/labels'
import { formatDate } from '../../i18n/format'

export default function ChallengeDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useAuth()
  const [challenge, setChallenge] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    challengesApi
      .detail(id)
      .then(setChallenge)
      .catch((err) => setError(err.message))
  }, [id])

  const onDelete = async () => {
    if (!window.confirm(t('challenges.detail.confirmDelete'))) return
    await challengesApi.remove(id)
    showToast(t('app.deleted'))
    navigate('/challenges')
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!challenge) return <p>{t('app.loading')}</p>

  const p = challenge.progress

  return (
    <div className="page-challenge-detail">
      <section className="detail-hero challenge-detail-hero">
        <div className="detail-info">
          <span className={`status status-challenge-${challenge.status}`}>
            {labelFromCode('challenges.status', challenge.status, challenge.status_display)}
          </span>
          <h1>{challenge.title}</h1>
          {challenge.description ? <p>{challenge.description}</p> : null}
          <p className="meta-pill">
            {t('challenges.periodLabel', {
              duration: challenge.duration,
              unit: labelFromCode(
                'challenges.periodUnit',
                challenge.period_unit,
                challenge.period_unit_display,
              ),
            })}{' '}
            ·{' '}
            {t('challenges.dateRange', {
              start: formatDate(challenge.starts_on),
              end: formatDate(challenge.ends_on),
            })}
          </p>
          <div className="cluster">
            <Link to={`/challenges/${id}/edit`} className="btn btn-secondary">
              {t('app.edit')}
            </Link>
            <button type="button" className="btn btn-danger-ghost" onClick={onDelete}>
              {t('app.delete')}
            </button>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="surface">
          <h2>{t('challenges.detail.dualProgress')}</h2>
          <div className="dual-progress">
            <div>
              <span>
                {t('challenges.detail.timeLeft', {
                  percent: p.time_percent,
                  days: p.days_left,
                })}
              </span>
              <div className="progress progress-time large">
                <span style={{ width: `${p.time_percent}%` }} />
              </div>
            </div>
            <div>
              <span>
                {t('challenges.detail.booksDone', {
                  percent: p.completion_percent,
                  done: p.books_done,
                  total: p.books_total,
                })}
              </span>
              <div className="progress progress-done large">
                <span style={{ width: `${p.completion_percent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page-toolbar">
          <h2>{t('challenges.detail.challengeBooks')}</h2>
        </div>
        <div className="book-grid">
          {challenge.books.map((b) => (
            <div key={b.book_id} className="book-tile">
              <div className="book-cover">
                {b.cover_url ? <img src={b.cover_url} alt="" /> : <div className="cover-fallback" />}
              </div>
              <div className="book-meta">
                <h3>{b.title}</h3>
                <p>{b.author}</p>
                <span className={`status${b.shelf_status ? ` status-${b.shelf_status}` : ''}`}>
                  {labelFromCode('books.status', b.shelf_status, b.shelf_status_display)}
                </span>
                <div className="progress">
                  <span style={{ width: `${b.progress_percent}%` }} />
                </div>
                {b.shelf_id ? (
                  <Link to={`/books/${b.shelf_id}`} className="text-link">
                    {t('challenges.detail.goToShelf')}
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
