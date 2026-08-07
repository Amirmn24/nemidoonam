import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi } from '../../shared/api'
import { labelFromCode } from '../../i18n/labels'
import { RatingBadge } from './components/BookRatingPanel'

export default function BookListPage() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const active = params.get('status') || ''

  useEffect(() => {
    booksApi
      .list()
      .then(setData)
      .catch((err) => setError(err.message || t('app.error')))
  }, [t])

  const filtered = useMemo(() => {
    if (!data) return []
    if (!active) return data.results
    return data.results.filter((b) => b.status === active)
  }, [data, active])

  const setStatus = (status) => {
    const next = new URLSearchParams(params)
    if (status) next.set('status', status)
    else next.delete('status')
    setParams(next, { replace: true })
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!data) return <p>{t('books.list.loading')}</p>

  return (
    <div className="page-home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t('books.list.eyebrow')}</p>
          <h1>{t('books.list.title')}</h1>
          <p>{t('books.list.subtitle')}</p>
          <div className="cluster">
            <Link to="/books/new" className="btn btn-primary btn-lg">
              {t('books.list.addBook')}
            </Link>
          </div>
        </div>
        {data.total_count > 0 ? (
          <div className="hero-stats">
            <div>
              <strong>{data.total_count}</strong>
              <span>{t('books.list.statBooks')}</span>
            </div>
            <div>
              <strong>{data.reading_count}</strong>
              <span>{t('books.list.statReading')}</span>
            </div>
            <div>
              <strong>{data.finished_count}</strong>
              <span>{t('books.list.statFinished')}</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section library" id="library">
        <div className="page-toolbar">
          <h2>{t('books.list.shelf')}</h2>
        </div>
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
              {labelFromCode('books.status', s.value, s.label)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{t('books.list.emptyTitle')}</h3>
            <p>{t('books.list.emptyBody')}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setStatus('')}>
              {t('books.list.showAll')}
            </button>
          </div>
        ) : (
          <div className="book-grid">
            {filtered.map((book) => (
              <Link key={book.id} to={`/books/${book.id}`} className="book-tile">
                <div className="book-cover">
                  {book.cover_url ? <img src={book.cover_url} alt="" /> : <div className="cover-fallback" />}
                </div>
                <div className="book-meta">
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <div className="cluster">
                    <span className={`status status-${book.status}`}>
                      {labelFromCode('books.status', book.status, book.status_display)}
                    </span>
                    <RatingBadge score={book.overall_score} />
                  </div>
                  <div className="book-progress-label">
                    {t('books.list.progressLabel', {
                      current: book.current_page,
                      total: book.total_pages,
                      percent: book.progress_percent,
                    })}
                  </div>
                  <div className="progress">
                    <span style={{ width: `${book.progress_percent}%` }} />
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
