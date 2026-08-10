import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * ناوبری صفحه: قبلی / ورودی شماره / بعدی + چند از چند.
 */
export default function PdfPageNav({
  currentPage,
  pageCount,
  onGoToPage,
  onPrev,
  onNext,
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(String(currentPage || 1))

  useEffect(() => {
    setDraft(String(currentPage || 1))
  }, [currentPage])

  const commit = () => {
    const n = Number.parseInt(String(draft).replace(/[^\d]/g, ''), 10)
    if (!Number.isFinite(n)) {
      setDraft(String(currentPage || 1))
      return
    }
    onGoToPage?.(n)
  }

  const disabled = !pageCount

  return (
    <div className="pdf-page-nav" role="group" aria-label={t('pdf.nav.label')}>
      <button
        type="button"
        className="pdf-tool-btn"
        onClick={onPrev}
        disabled={disabled || currentPage <= 1}
        title={t('pdf.nav.prev')}
      >
        ‹
      </button>
      <label className="pdf-page-nav-input-wrap">
        <span className="visually-hidden">{t('pdf.nav.goTo')}</span>
        <input
          className="pdf-page-nav-input"
          type="text"
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          aria-label={t('pdf.nav.goTo')}
        />
      </label>
      <span className="pdf-page-nav-of">
        {t('pdf.nav.of', { total: pageCount || '—' })}
      </span>
      <button
        type="button"
        className="pdf-tool-btn"
        onClick={onNext}
        disabled={disabled || currentPage >= pageCount}
        title={t('pdf.nav.next')}
      >
        ›
      </button>
    </div>
  )
}
