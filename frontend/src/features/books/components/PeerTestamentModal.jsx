import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** پاپ‌آپ یک‌بارهٔ وصیت تصادفی دیگران هنگام شروع خواندن */
export default function PeerTestamentModal({ open, peer, onClose }) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !peer) return null

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="peer-testament-title">
      <div className="book-modal-backdrop" onClick={onClose} />
      <div className="book-modal-sheet testament-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.testament.peerEyebrow')}</p>
            <h2 id="peer-testament-title">{t('books.testament.peerTitle')}</h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label={t('app.close')}>
            {t('app.close')}
          </button>
        </div>
        <figure className="peer-testament-card">
          <blockquote>
            <p>{peer.text}</p>
          </blockquote>
          <figcaption>
            {peer.author_label || t('books.testament.authorFallback')}
          </figcaption>
        </figure>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('app.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
