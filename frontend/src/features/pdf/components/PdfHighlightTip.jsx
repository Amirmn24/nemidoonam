import { useTranslation } from 'react-i18next'
import { HIGHLIGHT_COLORS } from '../lib/highlightGeometry'

function clampX(x) {
  return Math.min(Math.max(12, x), window.innerWidth - 12)
}

function clampY(y) {
  return Math.min(Math.max(8, y), window.innerHeight - 8)
}

/**
 * کپی بالای انتخاب؛ رنگ‌ها جدا، زیر متن.
 */
export default function PdfHighlightTip({ draft, copied, onPickColor, onCopy, onCancel }) {
  const { t } = useTranslation()
  if (!draft?.bounds) return null

  const { bounds, kind } = draft
  const midX = clampX((bounds.left + bounds.right) / 2)
  const placeCopyAbove = bounds.top > 44
  const copyTop = clampY(placeCopyAbove ? bounds.top - 8 : bounds.top + 8)
  const colorsTop = clampY(bounds.bottom + 8)
  const isImage = kind === 'image'
  const copyLabel = copied
    ? t('pdf.highlight.copied')
    : isImage
      ? t('pdf.highlight.copyImage')
      : t('pdf.highlight.copy')

  const showCopy = isImage || Boolean(draft.quote)

  return (
    <>
      {showCopy ? (
        <button
          type="button"
          className={`pdf-sel-copy${copied ? ' is-copied' : ''}`}
          style={{
            left: midX,
            top: copyTop,
            transform: placeCopyAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
          dir="rtl"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCopy}
        >
          {copyLabel}
        </button>
      ) : null}
      {isImage ? null : (
        <div
          className="pdf-hl-tip"
          style={{ left: midX, top: colorsTop, transform: 'translateX(-50%)' }}
          dir="rtl"
          role="dialog"
          aria-label={t('pdf.highlight.pickColor')}
          onMouseDown={(event) => event.preventDefault()}
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
          <button
            type="button"
            className="pdf-hl-tip-cancel"
            onClick={onCancel}
            aria-label={t('app.close')}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
