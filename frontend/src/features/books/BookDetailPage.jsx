import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { booksApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import BookRatingPanel, { RatingBadge } from './components/BookRatingPanel'
import EntryTimelineItem from './components/EntryTimelineItem'
import FinishConfirmModal from './components/FinishConfirmModal'
import FinalViewpointModal from './components/FinalViewpointModal'
import FinishedBookPlaylist from './components/FinishedBookPlaylist'
import FirstFinalViewpointModal from './components/FirstFinalViewpointModal'
import MidpointPredictionModal from './components/MidpointPredictionModal'
import PeerViewpointModal from './components/PeerViewpointModal'

function ReadingDetail({
  id,
  book,
  data,
  kind,
  media,
  busy,
  onProgress,
  onAskFinish,
  onDelete,
  onDeleteEntry,
  setFilter,
}) {
  const statuses = [
    ['want_to_read', 'می‌خواهم بخوانم'],
    ['reading', 'در حال خواندن'],
    ['paused', 'متوقف شده'],
    ['finished', 'تمام شده'],
    ['abandoned', 'رها شده'],
  ]

  return (
    <>
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
            <button type="button" className="btn btn-secondary" onClick={onAskFinish} disabled={busy}>
              تیک پایان
            </button>
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
          </ul>
        </aside>
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
    </>
  )
}

function FinishedDetail({
  id,
  book,
  data,
  social,
  busy,
  onSaveRating,
  onDelete,
  onRevealPeer,
  onAskFinalViewpoint,
}) {
  const hasFinal = Boolean(social?.has_final_viewpoint)

  return (
    <>
      <section className="detail-hero detail-hero-finished">
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
          <p className="finished-lead">
            کتاب تمام شد؛ امتیاز بده، دیدگاه پایانی بنویس و اگر خواستی تحلیل دیگران را ببین.
          </p>
          <div className="cluster">
            <Link to={`/books/${id}/edit`} className="btn btn-ghost">
              ویرایش مشخصات
            </Link>
            <button type="button" className="btn btn-danger-ghost" onClick={onDelete}>
              حذف از قفسه
            </button>
          </div>
        </div>
      </section>

      <section className="section" id="social-final">
        <div className="surface social-final-panel">
          <div className="social-final-copy">
            <p className="eyebrow">اجتماعی</p>
            <h2>دیدگاه پایانی</h2>
            {hasFinal ? (
              <p>
                دیدگاه پایانی‌ات ثبت شده. می‌توانی یک دیدگاه تصادفی از کسانی که این کتاب را تمام کرده‌اند ببینی.
              </p>
            ) : (
              <p>
                با ثبت یک دیدگاه پایانی، قفل دیدن تحلیل دیگران برای این کتاب باز می‌شود.
              </p>
            )}
          </div>
          <div className="cluster social-final-actions">
            {!hasFinal ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onAskFinalViewpoint}>
                ثبت دیدگاه پایانی
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={onRevealPeer}>
                  دیدگاه دیگران
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={onAskFinalViewpoint}>
                  دیدگاه دیگر از خودم
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="rating">
        <div className="surface">
          <BookRatingPanel
            factors={data.rating_factors}
            rating={data.rating}
            canRate
            busy={busy}
            onSubmit={onSaveRating}
          />
        </div>
      </section>

      <FinishedBookPlaylist entries={data.entries} />
    </>
  )
}

export default function BookDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useAuth()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showMidpoint, setShowMidpoint] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showFinalModal, setShowFinalModal] = useState(false)
  const [showFirstFinal, setShowFirstFinal] = useState(false)
  const [peerOpen, setPeerOpen] = useState(false)
  const [peerBusy, setPeerBusy] = useState(false)
  const [peerView, setPeerView] = useState(null)
  const [peerEmpty, setPeerEmpty] = useState(false)
  const [peerError, setPeerError] = useState('')

  const kind = params.get('kind') || ''
  const media = params.get('media') || ''

  const load = () =>
    booksApi
      .detail(id, { kind: kind || undefined, media: media || undefined })
      .then((payload) => {
        setData(payload)
        if (payload.ask_midpoint_prediction || payload.book?.ask_midpoint_prediction) {
          setShowMidpoint(true)
        }
      })
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
      const result = await booksApi.progress(id, {
        current_page: Number(fd.get('current_page')),
        status: fd.get('status'),
      })
      showToast('پیشرفت ذخیره شد.', 'success')
      if (result.ask_midpoint_prediction) setShowMidpoint(true)
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onFinishConfirm = async () => {
    setBusy(true)
    try {
      await booksApi.finish(id)
      showToast('کتاب تمام شد. حالا می‌توانی دیدگاه پایانی ثبت کنی.', 'success')
      setShowMidpoint(false)
      setShowFinishConfirm(false)
      await load()
      setShowFinalModal(true)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onSubmitFinalViewpoint = async ({ media_type, text_content, audioBlob }) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('kind', 'final_viewpoint')
      fd.set('media_type', media_type)
      fd.set('text_content', text_content || '')
      fd.set('is_public', 'true')
      fd.set('is_sealed', 'false')
      fd.set('entry_date', new Date().toISOString().slice(0, 10))
      if (media_type === 'voice' && audioBlob) {
        fd.set('audio', audioBlob, 'final-viewpoint.webm')
      }
      const saved = await booksApi.createEntry(id, fd)
      showToast('دیدگاه پایانی ثبت شد.', 'success')
      setShowFinalModal(false)
      await load()
      if (saved?.is_first_final_for_book) setShowFirstFinal(true)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'ثبت دیدگاه ناموفق بود.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const fetchPeerViewpoint = useCallback(async () => {
    setPeerBusy(true)
    setPeerError('')
    try {
      const res = await booksApi.peerFinalViewpoint(id)
      if (res.empty || !res.viewpoint) {
        setPeerView(null)
        setPeerEmpty(true)
      } else {
        setPeerEmpty(false)
        setPeerView(res.viewpoint)
      }
      if (res.social) {
        setData((prev) => (prev ? { ...prev, social: res.social } : prev))
      }
    } catch (err) {
      setPeerError(err instanceof ApiError ? err.message : 'بارگذاری ناموفق بود.')
      setPeerView(null)
    } finally {
      setPeerBusy(false)
    }
  }, [id])

  const onRevealPeer = async () => {
    setPeerOpen(true)
    setPeerView(null)
    setPeerEmpty(false)
    setPeerError('')
    await fetchPeerViewpoint()
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

  const onSubmitMidpoint = async (text) => {
    setBusy(true)
    try {
      await booksApi.midpointPrediction(id, { text })
      showToast('پیش‌بینی‌ات مهروموم شد.', 'success')
      setShowMidpoint(false)
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'خطا', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onDismissMidpoint = async () => {
    setBusy(true)
    try {
      await booksApi.midpointPrediction(id, { dismiss: true })
      setShowMidpoint(false)
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
  const isFinished = book.status === 'finished' || data.view_mode === 'playlist'
  const social = data.social || {}

  return (
    <div className={`page-detail${isFinished ? ' is-finished' : ''}`}>
      {isFinished ? (
        <FinishedDetail
          id={id}
          book={book}
          data={data}
          social={social}
          busy={busy}
          onSaveRating={onSaveRating}
          onDelete={onDelete}
          onRevealPeer={onRevealPeer}
          onAskFinalViewpoint={() => setShowFinalModal(true)}
        />
      ) : (
        <ReadingDetail
          id={id}
          book={book}
          data={data}
          kind={kind}
          media={media}
          busy={busy}
          onProgress={onProgress}
          onAskFinish={() => setShowFinishConfirm(true)}
          onDelete={onDelete}
          onDeleteEntry={onDeleteEntry}
          setFilter={setFilter}
        />
      )}

      <MidpointPredictionModal
        open={showMidpoint && !isFinished}
        busy={busy}
        onSubmit={onSubmitMidpoint}
        onDismiss={onDismissMidpoint}
      />

      <FinishConfirmModal
        open={showFinishConfirm && !isFinished}
        busy={busy}
        bookTitle={book.title}
        onConfirm={onFinishConfirm}
        onCancel={() => setShowFinishConfirm(false)}
      />

      <FinalViewpointModal
        open={showFinalModal && isFinished}
        busy={busy}
        bookTitle={book.title}
        onSubmit={onSubmitFinalViewpoint}
        onClose={() => setShowFinalModal(false)}
      />

      <FirstFinalViewpointModal
        open={showFirstFinal}
        bookTitle={book.title}
        bookId={id}
        onClose={() => setShowFirstFinal(false)}
      />

      <PeerViewpointModal
        open={peerOpen}
        busy={peerBusy}
        viewpoint={peerView}
        empty={peerEmpty}
        error={peerError}
        onRefresh={fetchPeerViewpoint}
        onClose={() => setPeerOpen(false)}
      />
    </div>
  )
}
