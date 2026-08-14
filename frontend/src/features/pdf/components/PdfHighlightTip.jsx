import { useTranslation } from 'react-i18next'
import { HIGHLIGHT_COLORS } from '../lib/highlightGeometry'

/**
 * پالت شناور بعد از انتخاب متن — ذخیره فقط با انتخاب رنگ.
 */
export default function PdfHighlightTip({ draft, onPickColor, onCancel }) {
  const { t } = useTranslation()
  if (!draft) return null

  const left = Math.min(Math.max(12, draft.x), window.innerWidth - 200)
  const top = Math.min(Math.max(12, draft.y + 10), window.innerHeight - 56)

  return (
    <div
      className="pdf-hl-tip"
      style={{ left, top }}
      role="dialog"
      aria-label={t('pdf.highlight.pickColor')}
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`pdf-hl-swatch is-${color}`}
          title={t(`pdf.highlight.color.${color}`)}
          aria-label={t(`pdf.highlight.color.${color}`)}
          onClick={() => onPickColor(color)}
        />
      ))}
      <button type="button" className="pdf-hl-tip-cancel" onClick={onCancel} aria-label={t('app.close')}>
        ×
      </button>
    </div>
  )
}
