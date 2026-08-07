import { useEffect } from 'react'

/** تأیید آگاهانهٔ اتمام کتاب قبل از تیک پایان */
export default function FinishConfirmModal({ open, busy, bookTitle, onConfirm, onCancel }) {
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
            <p className="eyebrow">اتمام کتاب</p>
            <h2 id="finish-confirm-title">واقعاً تموم شده؟</h2>
          </div>
        </div>
        <p className="finish-confirm-copy">
          {bookTitle ? (
            <>
              «{bookTitle}» را به‌عنوان تمام‌شده علامت بزنم؟ یادداشت‌های مهروموم باز می‌شوند و بعد می‌توانی
              دیدگاه پایانی ثبت کنی.
            </>
          ) : (
            <>کتاب را تمام‌شده علامت بزنم؟ یادداشت‌های مهروموم باز می‌شوند.</>
          )}
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? 'در حال ثبت…' : 'بله، تمام شد'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            نه، هنوز نه
          </button>
        </div>
      </div>
    </div>
  )
}
