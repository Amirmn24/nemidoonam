import { useEffect, useState } from 'react'

/** پاپ‌آپ اولین عبور از نیمهٔ کتاب — پیش‌بینی پایان (مهروموم می‌شود) */
export default function MidpointPredictionModal({ open, busy, onSubmit, onDismiss }) {
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
            <p className="eyebrow">نیمه‌راه کتاب</p>
            <h2 id="midpoint-title">به‌نظرت آخر کتاب چی می‌شه؟</h2>
          </div>
        </div>
        <p className="midpoint-hint">
          حدست را بنویس؛ تا پایان کتاب مهروموم می‌ماند و بعد از اتمام دوباره می‌بینی‌اش.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim() || busy) return
            onSubmit(text.trim())
          }}
        >
          <div className="field">
            <label htmlFor="midpoint-text">پیش‌بینی پایان</label>
            <textarea
              id="midpoint-text"
              className="field-textarea"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="مثلاً فکر می‌کنم قهرمان…"
              required
              autoFocus
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
              مهروموم کن
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDismiss}>
              فعلاً نه
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
