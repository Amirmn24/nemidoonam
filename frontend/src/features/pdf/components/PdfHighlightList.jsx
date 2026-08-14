import { useTranslation } from 'react-i18next'
import { HIGHLIGHT_COLORS } from '../lib/highlightGeometry'

/**
 * فهرست هایلایت‌های ذخیره‌شده — پرش به صفحه و حذف/تغییر رنگ.
 */
export default function PdfHighlightList({
  highlights,
  currentPage,
  onJump,
  onDelete,
  onChangeColor,
}) {
  const { t } = useTranslation()
  const items = highlights || []

  if (!items.length) {
    return <p className="pdf-hl-empty">{t('pdf.highlight.empty')}</p>
  }

  return (
    <ul className="pdf-hl-list">
      {items.map((hl) => (
        <li
          key={hl.id}
          className={`pdf-hl-item${hl.page_number === currentPage ? ' is-current' : ''}`}
        >
          <button
            type="button"
            className="pdf-hl-item-jump"
            onClick={() => onJump(hl.page_number)}
          >
            <span className="pdf-hl-item-meta">
              <span className={`pdf-hl-dot pdf-hl-${hl.color || 'yellow'}`} />
              <span className="pdf-hl-page">
                {t('pdf.nav.pageAria', { page: hl.page_number })}
              </span>
            </span>
            <span className="pdf-hl-quote">
              {hl.quote || t('pdf.highlight.noQuote')}
            </span>
          </button>
          <div className="pdf-hl-item-actions">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`pdf-hl-swatch is-mini is-${color}${hl.color === color ? ' is-selected' : ''}`}
                aria-label={t(`pdf.highlight.color.${color}`)}
                onClick={() => onChangeColor(hl.id, color)}
              />
            ))}
            <button
              type="button"
              className="pdf-hl-delete"
              onClick={() => onDelete(hl.id)}
              aria-label={t('pdf.highlight.delete')}
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
