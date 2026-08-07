import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** پاپ‌آپ اولین عبور از نیمهٔ کتاب — پیش‌بینی پایان (مهروموم می‌شود) */
export default function MidpointPredictionModal({ open, busy, onSubmit, onDismiss }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  useEffect(() => {
    if (!open) setText('')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="midpoint-title">
      <div className="book-modal-backdrop" onClick={busy ? undefined : onDismiss} />
      <div className="book-modal-sheet midpoint-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.midpoint.eyebrow')}</p>
            <h2 id="midpoint-title">{t('books.midpoint.title')}</h2>
          </div>
        </div>
        <p className="midpoint-hint">{t('books.midpoint.hint')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim() || busy) return
            onSubmit(text.trim())
          }}
        >
          <div className="field">
            <label htmlFor="midpoint-text">{t('books.midpoint.label')}</label>
            <textarea
              id="midpoint-text"
              className="field-textarea"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('books.midpoint.placeholder')}
              required
              autoFocus
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
              {t('books.midpoint.seal')}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDismiss}>
              {t('books.midpoint.skip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
