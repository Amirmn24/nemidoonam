import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** پاپ‌آپ اولین دیدگاه پایانی عمومی برای یک کتاب کاتالوگ */
export default function FirstFinalViewpointModal({ open, bookTitle, bookId, onClose }) {
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

  if (!open) return null

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="first-final-title">
      <div className="book-modal-backdrop" onClick={onClose} />
      <div className="book-modal-sheet first-final-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.firstFinal.eyebrow')}</p>
            <h2 id="first-final-title">{t('books.firstFinal.title')}</h2>
          </div>
        </div>
        <p className="first-final-copy">
          {bookTitle
            ? t('books.firstFinal.bodyWithTitle', { title: bookTitle })
            : t('books.firstFinal.body')}
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('books.firstFinal.great')}
          </button>
          {bookId ? (
            <Link to={`/books/${bookId}`} className="btn btn-ghost" onClick={onClose}>
              {t('books.firstFinal.goToBook')}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
