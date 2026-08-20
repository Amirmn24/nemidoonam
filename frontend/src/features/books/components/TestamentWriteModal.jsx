import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

function countLines(text) {
  const trimmed = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!trimmed.trim()) return 0
  return trimmed
    .split('\n')
    .map((ln) => ln.trim())
    .filter(Boolean).length
}

/** پاپ‌آپ ثبت یا مشاهدهٔ وصیت کوتاه (حداکثر ۳ خط) */
export default function TestamentWriteModal({
  open,
  busy,
  testament,
  onSubmit,
  onClose,
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState('')

  const maxLen = testament?.max_length || 160
  const maxLines = testament?.max_lines || 3
  const hasOwn = Boolean(testament?.has_own && testament?.own)
  const canWrite = hasOwn ? false : Boolean(testament?.can_write ?? true)
  const own = testament?.own

  useEffect(() => {
    if (!open) {
      setDraft('')
      setLocalError('')
    }
  }, [open])

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

  const lineCount = useMemo(() => countLines(draft), [draft])
  const remaining = maxLen - draft.length

  if (!open) return null

  const handleChange = (e) => {
    const next = e.target.value
    if (next.length > maxLen) return
    if (countLines(next) > maxLines) {
      setLocalError(t('books.testament.tooManyLines', { count: maxLines }))
      return
    }
    setLocalError('')
    setDraft(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canWrite || busy) return
    setLocalError('')
    if (!draft.trim()) {
      setLocalError(t('books.testament.required'))
      return
    }
    if (countLines(draft) > maxLines) {
      setLocalError(t('books.testament.tooManyLines', { count: maxLines }))
      return
    }
    await onSubmit(draft.trim())
  }

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="testament-write-title">
      <div className="book-modal-backdrop" onClick={busy ? undefined : onClose} />
      <div className="book-modal-sheet testament-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">
              {canWrite ? t('books.testament.writeEyebrow') : t('books.testament.ownEyebrow')}
            </p>
            <h2 id="testament-write-title">
              {canWrite ? t('books.testament.writeTitle') : t('books.testament.ownTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={onClose}
            aria-label={t('app.close')}
          >
            {t('app.close')}
          </button>
        </div>

        {canWrite ? (
          <>
            <p className="testament-hint">{t('books.testament.writeHint')}</p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label className="sr-only" htmlFor="testament-text">
                  {t('books.testament.writeTitle')}
                </label>
                <textarea
                  id="testament-text"
                  className="field-input testament-textarea"
                  rows={maxLines}
                  maxLength={maxLen}
                  value={draft}
                  onChange={handleChange}
                  disabled={busy}
                  placeholder={t('books.testament.placeholder')}
                  autoFocus
                />
              </div>
              <div className="testament-meta">
                <span>{t('books.testament.linesMeta', { current: lineCount, max: maxLines })}</span>
                <span>{t('books.testament.charsMeta', { remaining })}</span>
              </div>
              {localError ? <p className="form-errors">{localError}</p> : null}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
                  {t('books.testament.submit')}
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
                  {t('app.cancel')}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="testament-own-text">{own?.text || ''}</p>
            <p className="testament-hint">{t('books.testament.onceHint')}</p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {t('app.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
