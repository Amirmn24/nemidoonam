import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** تأیید رضایت برای عمومی‌سازی یادداشت (دیدگاه / حس / متن) */
export default function PublicConsentModal({ open, busy, kindLabel, onConfirm, onCancel }) {
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
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="public-consent-title">
      <div className="book-modal-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="book-modal-sheet public-consent-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.publicConsent.eyebrow')}</p>
            <h2 id="public-consent-title">{t('books.publicConsent.title')}</h2>
          </div>
        </div>
        <p className="finish-confirm-copy">
          {kindLabel
            ? t('books.publicConsent.bodyWithKind', { kind: kindLabel })
            : t('books.publicConsent.body')}
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? t('app.submitting') : t('books.publicConsent.confirm')}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            {t('books.publicConsent.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
