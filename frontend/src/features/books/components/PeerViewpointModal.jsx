import { useEffect } from 'react'

/** یک‌بار نمایش دیدگاه پایانی تصادفی دیگران — بدون تکرار */
export default function PeerViewpointModal({ open, busy, viewpoint, empty, error, onClose }) {
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
            <p className="eyebrow">دیدگاه دیگران</p>
            <h2 id="peer-viewpoint-title">یک نگاه از بقیه</h2>
          </div>
        </div>

        {error ? <p className="form-errors">{error}</p> : null}

        {busy && !viewpoint && !empty ? (
          <p className="peer-viewpoint-loading">در حال آوردن یک دیدگاه…</p>
        ) : null}

        {empty ? (
          <div className="peer-viewpoint-empty">
            <p>هنوز کسی غیر از تو دیدگاه پایانی عمومی برای این کتاب ثبت نکرده.</p>
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
              <span>{viewpoint.author_label || 'خواننده‌ای دیگر'}</span>
              {viewpoint.entry_date ? <time dateTime={viewpoint.entry_date}>{viewpoint.entry_date}</time> : null}
            </figcaption>
          </figure>
        ) : null}

        <p className="peer-viewpoint-once-hint">این فقط یک‌بار برای این کتاب نشان داده می‌شود.</p>

        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onClose}>
            دیدم
          </button>
        </div>
      </div>
    </div>
  )
}
