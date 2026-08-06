import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { booksApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import BookRatingPanel, { RatingBadge } from './components/BookRatingPanel'
import EntryTimelineItem from './components/EntryTimelineItem'

export default function BookDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useAuth()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const kind = params.get('kind') || ''
  const media = params.get('media') || ''

  const load = () =>
    booksApi
      .detail(id, { kind: kind || undefined, media: media || undefined })
      .then(setData)
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [id, kind, media])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const onProgress = async (e) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.target)
    try {
      await booksApi.progress(id, {
        current_page: Number(fd.get('current_page')),
        status: fd.get('status'),
      })
      showToast('پیشرفت ذخیره شد.', 'success')
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onFinish = async () => {
    if (!window.confirm('کتاب را به‌عنوان تمام‌شده علامت بزنم؟ یادداشت‌های مهروموم باز می‌شوند.')) return
    setBusy(true)
    try {
      await booksApi.finish(id)
      showToast('کتاب تمام شد. حالا می‌توانی امتیاز بدهی.', 'success')
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onSaveRating = async (payload) => {
    setBusy(true)
    try {
      await booksApi.saveRating(id, payload)
      showToast('امتیاز ذخیره شد.', 'success')
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!window.confirm('این کتاب از قفسه حذف شود؟')) return
    await booksApi.remove(id)
    showToast('حذف شد.')
    navigate('/books')
  }

  const onDeleteEntry = async (entryId) => {
    if (!window.confirm('یادداشت حذف شود؟')) return
    await booksApi.deleteEntry(id, entryId)
    showToast('یادداشت حذف شد.')
    await load()
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!data) return <p>در حال بارگذاری…</p>

  const book = data.book
  const isFinished = book.status === 'finished'
  const statuses = [
    ['want_to_read', 'می‌خواهم بخوانم'],
    ['reading', 'در حال خواندن'],
    ['paused', 'متوقف شده'],
    ['finished', 'تمام شده'],
    ['abandoned', 'رها شده'],
  ]

  return (
    <div className="page-detail">
      <section className="detail-hero">
        <div className="detail-cover">
          {book.cover_url ? <img src={book.cover_url} alt="" /> : <div className="cover-fallback" />}
        </div>
        <div className="detail-info">
          <div className="cluster">
            <span className={`status status-${book.status}`}>{book.status_display}</span>
            <RatingBadge score={book.overall_score} />
          </div>
          <h1>{book.title}</h1>
          <p className="meta-pill">{book.author}</p>
          {book.notes ? <p>{book.notes}</p> : null}
          <div className="cluster">
            <Link to={`/books/${id}/entries/new`} className="btn btn-primary">
              یادداشت جدید
            </Link>
            {!isFinished ? (
              <button type="button" className="btn btn-secondary" onClick={onFinish} disabled={busy}>
                تیک پایان
              </button>
            ) : null}
            <Link to={`/books/${id}/edit`} className="btn btn-ghost">
              ویرایش
            </Link>
            <button type="button" className="btn btn-danger-ghost" onClick={onDelete}>
              حذف
            </button>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="surface" id="progress">
          <h2>پیشرفت</h2>
          <div className="book-progress-label">
            {book.current_page} / {book.total_pages} · {book.progress_percent}%
          </div>
          <div className="progress large">
            <span style={{ width: `${book.progress_percent}%` }} />
          </div>
          <form onSubmit={onProgress} className="form-grid two" style={{ marginTop: '1rem' }}>
            <div className="field">
              <label>صفحه فعلی</label>
              <input
                name="current_page"
                type="number"
                min="0"
                className="field-input"
                defaultValue={book.current_page}
                key={`page-${book.current_page}`}
              />
            </div>
            <div className="field">
              <label>وضعیت</label>
              <select name="status" className="field-select" defaultValue={book.status} key={`st-${book.status}`}>
                {statuses.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions full">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                ذخیره پیشرفت
              </button>
            </div>
          </form>
        </div>
        <aside className="surface surface-muted detail-aside">
          <ul className="aside-list">
            <li>
              <span>صفحات</span>
              <strong>{book.total_pages}</strong>
            </li>
            <li>
              <span>یادداشت‌ها</span>
              <strong>{book.entry_count}</strong>
            </li>
            {book.overall_score != null ? (
              <li>
                <span>نمره تو</span>
                <strong>★ {Number(book.overall_score).toFixed(1)}</strong>
              </li>
            ) : null}
          </ul>
        </aside>
      </section>

      <section className="section" id="rating">
        <div className="surface">
          <BookRatingPanel
            factors={data.rating_factors}
            rating={data.rating}
            canRate={isFinished}
            busy={busy}
            onSubmit={onSaveRating}
          />
        </div>
      </section>

      <section className="section" id="entries">
        <div className="page-toolbar">
          <h2>یادداشت‌ها</h2>
          <Link to={`/books/${id}/entries/new`} className="btn btn-secondary">
            جدید
          </Link>
        </div>
        <div className="filter-bar">
          <button type="button" className={`chip${!kind ? ' is-active' : ''}`} onClick={() => setFilter('kind', '')}>
            همه انواع
          </button>
          {[
            ['viewpoint', 'دیدگاه'],
            ['feeling', 'حس'],
            ['book_text', 'متن کتاب'],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`chip${kind === v ? ' is-active' : ''}`}
              onClick={() => setFilter('kind', v)}
            >
              {l}
            </button>
          ))}
          <span className="filter-sep" />
          <button type="button" className={`chip${!media ? ' is-active' : ''}`} onClick={() => setFilter('media', '')}>
            همه رسانه‌ها
          </button>
          {[
            ['text', 'متن'],
            ['voice', 'ویس'],
            ['image', 'تصویر'],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`chip${media === v ? ' is-active' : ''}`}
              onClick={() => setFilter('media', v)}
            >
              {l}
            </button>
          ))}
        </div>

        {data.entries.length === 0 ? (
          <div className="empty-state compact">
            <h3>یادداشتی نیست</h3>
            <p>اولین حس یا نقل‌قول را ثبت کن.</p>
          </div>
        ) : (
          <div className="entry-timeline">
            {data.entries.map((entry) => (
              <EntryTimelineItem
                key={entry.id}
                entry={entry}
                bookId={id}
                onDelete={onDeleteEntry}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
