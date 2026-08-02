import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { challengesApi } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'

export default function ChallengeDetailPage() {
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
    if (!window.confirm('چالش حذف شود؟')) return
    await challengesApi.remove(id)
    showToast('حذف شد.')
    navigate('/challenges')
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!challenge) return <p>در حال بارگذاری…</p>

  const p = challenge.progress

  return (
    <div className="page-challenge-detail">
      <section className="detail-hero challenge-detail-hero">
        <div className="detail-info">
          <span className={`status status-challenge-${challenge.status}`}>{challenge.status_display}</span>
          <h1>{challenge.title}</h1>
          {challenge.description ? <p>{challenge.description}</p> : null}
          <p className="meta-pill">
            {challenge.period_label} · {challenge.starts_on} تا {challenge.ends_on}
          </p>
          <div className="cluster">
            <Link to={`/challenges/${id}/edit`} className="btn btn-secondary">
              ویرایش
            </Link>
            <button type="button" className="btn btn-danger-ghost" onClick={onDelete}>
              حذف
            </button>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="surface">
          <h2>پیشرفت دوگانه</h2>
          <div className="dual-progress">
            <div>
              <span>زمان {p.time_percent}% · {p.days_left} روز مانده</span>
              <div className="progress progress-time large">
                <span style={{ width: `${p.time_percent}%` }} />
              </div>
            </div>
            <div>
              <span>
                تکمیل {p.completion_percent}% · {p.books_done}/{p.books_total} کتاب
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
          <h2>کتاب‌های چالش</h2>
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
                  {b.shelf_status_display}
                </span>
                <div className="progress">
                  <span style={{ width: `${b.progress_percent}%` }} />
                </div>
                {b.shelf_id ? (
                  <Link to={`/books/${b.shelf_id}`} className="text-link">
                    برو به قفسه
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
