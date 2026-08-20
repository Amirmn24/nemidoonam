import { useTranslation } from 'react-i18next'

function clampX(x) {
  return Math.min(Math.max(12, x), window.innerWidth - 12)
}

function clampY(y) {
  return Math.min(Math.max(8, y), window.innerHeight - 8)
}

/**
 * کپی بالای انتخاب / عکس — بدون پالت رنگ (رنگ از نوار ابزار مداد می‌آید).
 */
export default function PdfHighlightTip({ draft, copied, onCopy }) {
  const { t } = useTranslation()
  if (!draft?.bounds) return null

  const { bounds, kind } = draft
  const midX = clampX((bounds.left + bounds.right) / 2)
  const placeCopyAbove = bounds.top > 44
  const copyTop = clampY(placeCopyAbove ? bounds.top - 8 : bounds.top + 8)
  const isImage = kind === 'image'
  const showCopy = isImage || Boolean(draft.quote)
  if (!showCopy) return null

  const copyLabel = copied
    ? t('pdf.highlight.copied')
    : isImage
      ? t('pdf.highlight.copyImage')
      : t('pdf.highlight.copy')

  return (
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
  )
}
