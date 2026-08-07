import { useEffect } from 'react'
import { Link } from 'react-router-dom'

/** پاپ‌آپ اولین دیدگاه پایانی عمومی برای یک کتاب کاتالوگ */
export default function FirstFinalViewpointModal({ open, bookTitle, bookId, onClose }) {
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

  if (!open) return null

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="first-final-title">
      <div className="book-modal-backdrop" onClick={onClose} />
      <div className="book-modal-sheet first-final-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">اولین ردپا</p>
            <h2 id="first-final-title">اولین دیدگاه این کتاب از توست</h2>
          </div>
        </div>
        <p className="first-final-copy">
          {bookTitle ? (
            <>
              اولین دیدگاه و تحلیل عمومی برای «{bookTitle}» را تو ثبت کردی. بقیه بعداً می‌توانند دیدگاه تو را
              ببینند.
            </>
          ) : (
            <>اولین دیدگاه و تحلیل عمومی این کتاب را تو ثبت کردی.</>
          )}
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            عالیه
          </button>
          {bookId ? (
            <Link to={`/books/${bookId}`} className="btn btn-ghost" onClick={onClose}>
              برو به کتاب
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
