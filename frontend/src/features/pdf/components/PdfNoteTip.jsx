import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function clampX(x) {
  return Math.min(Math.max(12, x), window.innerWidth - 12)
}

function clampY(y) {
  return Math.min(Math.max(8, y), window.innerHeight - 8)
}

/**
 * یادداشت کوتاه بلافاصله بعد از ذخیرهٔ هایلایت.
 */
export default function PdfNoteTip({ target, onSave, onSkip }) {
  const { t } = useTranslation()
  const [note, setNote] = useState(target?.note || '')

  useEffect(() => {
    setNote(target?.note || '')
  }, [target?.id, target?.note])

  if (!target?.bounds) return null

  const midX = clampX((target.bounds.left + target.bounds.right) / 2)
  const top = clampY(target.bounds.bottom + 10)

  return (
    <form
      className="pdf-note-tip"
      style={{ left: midX, top, transform: 'translateX(-50%)' }}
      dir="rtl"
      onMouseDown={(event) => event.preventDefault()}
      onSubmit={(event) => {
        event.preventDefault()
        onSave(note)
      }}
    >
      <label className="pdf-note-tip-label" htmlFor="pdf-note-input">
        {t('pdf.highlight.noteLabel')}
      </label>
      <input
        id="pdf-note-input"
        className="pdf-note-tip-input"
        type="text"
        maxLength={500}
        value={note}
        autoFocus
        placeholder={t('pdf.highlight.notePlaceholder')}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="pdf-note-tip-actions">
        <button type="submit" className="pdf-note-tip-save">
          {t('pdf.highlight.noteSave')}
        </button>
        <button type="button" className="pdf-note-tip-skip" onClick={onSkip}>
          {t('pdf.highlight.noteSkip')}
        </button>
      </div>
    </form>
  )
}
