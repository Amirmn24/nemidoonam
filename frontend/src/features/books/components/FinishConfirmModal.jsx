import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** تأیید آگاهانهٔ اتمام کتاب قبل از تیک پایان */
export default function FinishConfirmModal({ open, busy, bookTitle, onConfirm, onCancel }) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="finish-confirm-title">
      <div className="book-modal-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="book-modal-sheet finish-confirm-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.finishConfirm.eyebrow')}</p>
            <h2 id="finish-confirm-title">{t('books.finishConfirm.title')}</h2>
          </div>
        </div>
        <p className="finish-confirm-copy">
          {bookTitle
            ? t('books.finishConfirm.bodyWithTitle', { title: bookTitle })
            : t('books.finishConfirm.body')}
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? t('app.submitting') : t('books.finishConfirm.confirm')}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            {t('books.finishConfirm.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
