import { useEffect } from 'react'

/**
 * بعد از ثبت دیدگاه پایانی: تشکر + انتخاب دیدن دیدگاه دیگران (الان یا بعداً).
 * دیدن دیگران فقط یک‌بار ممکن است.
 */
export default function FinalViewpointThanksModal({
  open,
  bookTitle,
  isFirst,
  canSeePeer,
  busy,
  onSeePeer,
  onLater,
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onLater()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onLater])

  if (!open) return null

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="final-thanks-title">
      <div className="book-modal-backdrop" onClick={busy ? undefined : onLater} />
      <div className="book-modal-sheet final-thanks-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">ثبت شد</p>
            <h2 id="final-thanks-title">مرسی که دیدگاهت را ثبت کردی</h2>
          </div>
        </div>

        {isFirst ? (
          <p className="final-thanks-copy">
            {bookTitle ? (
              <>
                اولین دیدگاه و تحلیل عمومی برای «{bookTitle}» از توست. وقتی بقیه هم نوشتند، آن‌ها می‌توانند
                دیدگاه تو را ببینند.
              </>
            ) : (
              <>اولین دیدگاه عمومی این کتاب از توست. هنوز دیدگاه دیگری برای دیدن نیست.</>
            )}
          </p>
        ) : canSeePeer ? (
          <p className="final-thanks-copy">
            می‌توانی الان یک دیدگاه تصادفی از دیگران برای این کتاب ببینی — فقط یک‌بار — یا بگذاری برای بعد.
          </p>
        ) : (
          <p className="final-thanks-copy">دیدگاه پایانی‌ات ذخیره شد.</p>
        )}

        <div className="form-actions">
          {canSeePeer && !isFirst ? (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onSeePeer}>
                الان ببینم
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={onLater}>
                بعداً می‌بینم
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onLater}>
              باشه
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
