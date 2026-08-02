import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { booksApi } from '../../shared/api'

export default function BookListPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const active = params.get('status') || ''

  useEffect(() => {
    booksApi
      .list()
      .then(setData)
      .catch((err) => setError(err.message || 'خطا'))
  }, [])

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
  if (!data) return <p>در حال بارگذاری قفسه…</p>

  return (
    <div className="page-home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">قفسه شخصی</p>
          <h1>کتاب‌هایت اینجان</h1>
          <p>وضعیت‌ها، پیشرفت و یادداشت‌های هر ورق را همین‌جا نگه دار.</p>
          <div className="cluster">
            <Link to="/books/new" className="btn btn-primary btn-lg">
              افزودن کتاب
            </Link>
          </div>
        </div>
        {data.total_count > 0 ? (
          <div className="hero-stats">
            <div>
              <strong>{data.total_count}</strong>
              <span>کتاب</span>
            </div>
            <div>
              <strong>{data.reading_count}</strong>
              <span>در حال خواندن</span>
            </div>
            <div>
              <strong>{data.finished_count}</strong>
              <span>تمام‌شده</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section library" id="library">
        <div className="page-toolbar">
          <h2>قفسه</h2>
        </div>
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
            <h3>کتابی با این وضعیت نیست</h3>
            <p>فیلتر را عوض کن یا کتاب جدیدی اضافه کن.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setStatus('')}>
              نمایش همه
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
                  <span className={`status status-${book.status}`}>{book.status_display}</span>
                  <div className="book-progress-label">
                    {book.current_page} / {book.total_pages} · {book.progress_percent}%
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
