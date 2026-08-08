import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi, ApiError } from '../../shared/api'
import { labelFromCode } from '../../i18n/labels'
import { useAuth } from '../../shared/AuthContext'
import BookRatingPanel, { RatingBadge } from './components/BookRatingPanel'
import EntryTimelineItem from './components/EntryTimelineItem'
import FinishConfirmModal from './components/FinishConfirmModal'
import FinalViewpointModal from './components/FinalViewpointModal'
import FinishedBookPlaylist from './components/FinishedBookPlaylist'
import FirstFinalViewpointModal from './components/FirstFinalViewpointModal'
import MidpointPredictionModal from './components/MidpointPredictionModal'
import PeerViewpointModal from './components/PeerViewpointModal'
import PublicConsentModal from './components/PublicConsentModal'

const STATUS_VALUES = ['want_to_read', 'reading', 'paused', 'finished', 'abandoned']
const KIND_FILTERS = ['viewpoint', 'feeling', 'book_text']
const MEDIA_FILTERS = ['text', 'voice', 'image']

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
  onAskPublish,
  setFilter,
}) {
  const { t } = useTranslation()

  return (
    <>
      <section className="detail-hero">
        <div className="detail-cover">
          {book.cover_url ? <img src={book.cover_url} alt="" /> : <div className="cover-fallback" />}
        </div>
        <div className="detail-info">
          <div className="cluster">
            <span className={`status status-${book.status}`}>
              {labelFromCode('books.status', book.status, book.status_display)}
            </span>
            {book.resource_kind && book.resource_kind !== 'physical' ? (
              <span className="tag">{t(`books.resourceKind.${book.resource_kind}`)}</span>
            ) : null}
            <RatingBadge score={book.overall_score} />
          </div>
          <h1>{book.title}</h1>
          {book.author ? <p className="meta-pill">{book.author}</p> : null}
          {book.course ? <p className="meta-pill">{t('books.form.course')}: {book.course}</p> : null}
          {book.notes ? <p>{book.notes}</p> : null}
          <div className="cluster">
            {book.document?.pdf_url ? (
              <a
                className="btn btn-secondary"
                href={book.document.pdf_url}
                target="_blank"
                rel="noreferrer"
              >
                {t('books.detail.openPdf')}
              </a>
            ) : null}
            <Link to={`/books/${id}/entries/new`} className="btn btn-primary">
              {t('books.detail.newEntry')}
            </Link>
            <button type="button" className="btn btn-secondary" onClick={onAskFinish} disabled={busy}>
              {t('books.detail.finishTick')}
            </button>
            <Link to={`/books/${id}/edit`} className="btn btn-ghost">
              {t('app.edit')}
            </Link>
            <button type="button" className="btn btn-danger-ghost" onClick={onDelete}>
              {t('app.delete')}
            </button>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="surface" id="progress">
          <h2>{t('books.detail.progress')}</h2>
          <div className="book-progress-label">
            {t('books.list.progressLabel', {
              current: book.current_page,
              total: book.total_pages,
              percent: book.progress_percent,
            })}
          </div>
          <div className="progress large">
            <span style={{ width: `${book.progress_percent}%` }} />
          </div>
          <form onSubmit={onProgress} className="form-grid two" style={{ marginTop: '1rem' }}>
            <div className="field">
              <label>{t('books.form.currentPage')}</label>
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
              <label>{t('books.form.status')}</label>
              <select name="status" className="field-select" defaultValue={book.status} key={`st-${book.status}`}>
                {STATUS_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {t(`books.status.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions full">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {t('books.detail.saveProgress')}
              </button>
            </div>
          </form>
        </div>
        <aside className="surface surface-muted detail-aside">
          <ul className="aside-list">
            <li>
              <span>{t('books.detail.pages')}</span>
              <strong>{book.total_pages}</strong>
            </li>
            <li>
              <span>{t('books.detail.entries')}</span>
              <strong>{book.entry_count}</strong>
            </li>
          </ul>
        </aside>
      </section>

      <section className="section" id="entries">
        <div className="page-toolbar">
          <h2>{t('books.detail.entries')}</h2>
          <Link to={`/books/${id}/entries/new`} className="btn btn-secondary">
            {t('app.new')}
          </Link>
        </div>
        <div className="filter-bar">
          <button type="button" className={`chip${!kind ? ' is-active' : ''}`} onClick={() => setFilter('kind', '')}>
            {t('books.detail.allKinds')}
          </button>
          {KIND_FILTERS.map((v) => (
            <button
              key={v}
              type="button"
              className={`chip${kind === v ? ' is-active' : ''}`}
              onClick={() => setFilter('kind', v)}
            >
              {t(`books.kind.${v}`)}
            </button>
          ))}
          <span className="filter-sep" />
          <button type="button" className={`chip${!media ? ' is-active' : ''}`} onClick={() => setFilter('media', '')}>
            {t('books.detail.allMedia')}
          </button>
          {MEDIA_FILTERS.map((v) => (
            <button
              key={v}
              type="button"
              className={`chip${media === v ? ' is-active' : ''}`}
              onClick={() => setFilter('media', v)}
            >
              {t(`books.media.${v}`)}
            </button>
          ))}
        </div>

        {data.entries.length === 0 ? (
          <div className="empty-state compact">
            <h3>{t('books.detail.emptyEntriesTitle')}</h3>
            <p>{t('books.detail.emptyEntriesBody')}</p>
          </div>
        ) : (
          <div className="entry-timeline">
            {data.entries.map((entry) => (
              <EntryTimelineItem
                key={entry.id}
                entry={entry}
                bookId={id}
                onDelete={onDeleteEntry}
                onAskPublish={onAskPublish}
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
  const { t } = useTranslation()
  const hasFinal = Boolean(social?.has_final_viewpoint)

  return (
    <>
      <section className="detail-hero detail-hero-finished">
        <div className="detail-cover">
          {book.cover_url ? <img src={book.cover_url} alt="" /> : <div className="cover-fallback" />}
        </div>
        <div className="detail-info">
          <div className="cluster">
            <span className={`status status-${book.status}`}>
              {labelFromCode('books.status', book.status, book.status_display)}
            </span>
            <RatingBadge score={book.overall_score} />
          </div>
          <h1>{book.title}</h1>
          <p className="meta-pill">{book.author}</p>
          <p className="finished-lead">{t('books.detail.finishedLead')}</p>
          <div className="cluster">
            <Link to={`/books/${id}/edit`} className="btn btn-ghost">
              {t('books.detail.editMeta')}
            </Link>
            <button type="button" className="btn btn-danger-ghost" onClick={onDelete}>
              {t('books.detail.removeFromShelf')}
            </button>
          </div>
        </div>
      </section>

      <section className="section" id="social-final">
        <div className="surface social-final-panel">
          <div className="social-final-copy">
            <p className="eyebrow">{t('books.detail.socialEyebrow')}</p>
            <h2>{t('books.detail.finalViewpoint')}</h2>
            {hasFinal ? (
              <p>{t('books.detail.finalDone')}</p>
            ) : (
              <p>{t('books.detail.finalLocked')}</p>
            )}
          </div>
          <div className="cluster social-final-actions">
            {!hasFinal ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onAskFinalViewpoint}>
                {t('books.detail.submitFinal')}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={onRevealPeer}>
                  {t('books.detail.peerViewpoints')}
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={onAskFinalViewpoint}>
                  {t('books.detail.anotherOfMine')}
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
  const { t } = useTranslation()
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
  const [publishEntry, setPublishEntry] = useState(null)
  const [publishBusy, setPublishBusy] = useState(false)

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
      showToast(t('books.detail.progressSaved'), 'success')
      if (result.ask_midpoint_prediction) setShowMidpoint(true)
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('app.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onFinishConfirm = async () => {
    setBusy(true)
    try {
      await booksApi.finish(id)
      showToast(t('books.detail.finishedToast'), 'success')
      setShowMidpoint(false)
      setShowFinishConfirm(false)
      await load()
      setShowFinalModal(true)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('app.error'), 'error')
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
      showToast(t('books.detail.finalSaved'), 'success')
      setShowFinalModal(false)
      await load()
      if (saved?.is_first_final_for_book) setShowFirstFinal(true)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('books.detail.finalFailed'), 'error')
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
      setPeerError(err instanceof ApiError ? err.message : t('app.loadFailed'))
      setPeerView(null)
    } finally {
      setPeerBusy(false)
    }
  }, [id, t])

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
      showToast(t('books.detail.ratingSaved'), 'success')
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('app.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onSubmitMidpoint = async (text) => {
    setBusy(true)
    try {
      await booksApi.midpointPrediction(id, { text })
      showToast(t('books.detail.predictionSealed'), 'success')
      setShowMidpoint(false)
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('app.error'), 'error')
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
      showToast(err instanceof ApiError ? err.message : t('app.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!window.confirm(t('books.detail.confirmDeleteBook'))) return
    await booksApi.remove(id)
    showToast(t('app.deleted'))
    navigate('/books')
  }

  const onDeleteEntry = async (entryId) => {
    if (!window.confirm(t('books.detail.confirmDeleteEntry'))) return
    await booksApi.deleteEntry(id, entryId)
    showToast(t('books.detail.entryDeleted'))
    await load()
  }

  const onConfirmPublish = async () => {
    if (!publishEntry) return
    setPublishBusy(true)
    try {
      await booksApi.publishEntry(id, publishEntry.id)
      showToast(t('books.publicConsent.doneToast'), 'success')
      setPublishEntry(null)
      await load()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('app.saveFailed'), 'error')
    } finally {
      setPublishBusy(false)
    }
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!data) return <p>{t('app.loading')}</p>

  const book = data.book
  const isFinished = book.status === 'finished' || data.view_mode === 'playlist'
  const social = data.social || {}
  const publishKindLabel = publishEntry
    ? labelFromCode('books.kind', publishEntry.kind, publishEntry.kind_display)
    : ''

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
          onAskPublish={setPublishEntry}
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

      <PublicConsentModal
        open={Boolean(publishEntry)}
        busy={publishBusy}
        kindLabel={publishKindLabel}
        onConfirm={onConfirmPublish}
        onCancel={() => {
          if (!publishBusy) setPublishEntry(null)
        }}
      />
    </div>
  )
}
