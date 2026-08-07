import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** نمایش یک دیدگاه پایانی تصادفی از دیگران (متن یا ویس) */
export default function PeerViewpointModal({ open, busy, viewpoint, empty, error, onRefresh, onClose }) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onClose])

  if (!open) return null

  const isVoice = viewpoint?.media_type === 'voice'

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="peer-viewpoint-title">
      <div className="book-modal-backdrop" onClick={busy ? undefined : onClose} />
      <div className="book-modal-sheet peer-viewpoint-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.peer.eyebrow')}</p>
            <h2 id="peer-viewpoint-title">{t('books.peer.title')}</h2>
          </div>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose} aria-label={t('app.close')}>
            {t('app.close')}
          </button>
        </div>

        {error ? <p className="form-errors">{error}</p> : null}

        {busy && !viewpoint && !empty ? (
          <p className="peer-viewpoint-loading">{t('books.peer.loading')}</p>
        ) : null}

        {empty ? (
          <div className="peer-viewpoint-empty">
            <p>{t('books.peer.empty')}</p>
          </div>
        ) : null}

        {viewpoint ? (
          <figure className="peer-viewpoint-card">
            {isVoice && viewpoint.audio_url ? (
              <audio key={viewpoint.id} controls autoPlay src={viewpoint.audio_url} className="peer-viewpoint-audio" />
            ) : null}
            {!isVoice && viewpoint.text ? (
              <blockquote>
                <p>{viewpoint.text}</p>
              </blockquote>
            ) : null}
            <figcaption>
              <span>{viewpoint.author_label || t('books.peer.authorFallback')}</span>
              {viewpoint.entry_date ? <time dateTime={viewpoint.entry_date}>{viewpoint.entry_date}</time> : null}
            </figcaption>
          </figure>
        ) : null}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" disabled={busy || empty} onClick={onRefresh}>
            {busy ? t('books.peer.busyEllipsis') : t('books.peer.another')}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            {t('app.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
