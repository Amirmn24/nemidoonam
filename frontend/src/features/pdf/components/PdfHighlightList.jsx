import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HIGHLIGHT_PRESETS, normalizeHighlightColor } from '../lib/highlightGeometry'

/**
 * فهرست هایلایت‌ها با یادداشت و رنگ.
 */
export default function PdfHighlightList({
  highlights,
  currentPage,
  onJump,
  onDelete,
  onChangeColor,
  onChangeNote,
}) {
  const { t } = useTranslation()
  const items = highlights || []
  const [editingId, setEditingId] = useState(null)
  const [draftNote, setDraftNote] = useState('')

  if (!items.length) {
    return <p className="pdf-hl-empty">{t('pdf.highlight.empty')}</p>
  }

  const startEdit = (hl) => {
    setEditingId(hl.id)
    setDraftNote(hl.note || '')
  }

  const commitEdit = async (hl) => {
    const next = draftNote.trim()
    setEditingId(null)
    if ((hl.note || '') === next) return
    await onChangeNote?.(hl.id, next)
  }

  return (
    <ul className="pdf-hl-list">
      {items.map((hl) => {
        const color = normalizeHighlightColor(hl.color)
        return (
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
                <span className="pdf-hl-dot" style={{ background: color }} />
                <span className="pdf-hl-page">
                  {t('pdf.nav.pageAria', { page: hl.page_number })}
                </span>
              </span>
              {hl.note?.trim() ? (
                <span className="pdf-hl-note">{hl.note}</span>
              ) : null}
              <span className="pdf-hl-quote">
                {hl.quote || t('pdf.highlight.noQuote')}
              </span>
            </button>

            {editingId === hl.id ? (
              <div className="pdf-hl-note-edit">
                <input
                  type="text"
                  maxLength={500}
                  value={draftNote}
                  autoFocus
                  placeholder={t('pdf.highlight.notePlaceholder')}
                  onChange={(e) => setDraftNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitEdit(hl)
                    }
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <button type="button" className="pdf-hl-note-ok" onClick={() => commitEdit(hl)}>
                  {t('pdf.highlight.noteSave')}
                </button>
              </div>
            ) : (
              <div className="pdf-hl-item-actions">
                <button
                  type="button"
                  className="pdf-hl-note-btn"
                  onClick={() => startEdit(hl)}
                  title={t('pdf.highlight.noteLabel')}
                >
                  {t('pdf.highlight.noteEdit')}
                </button>
                <label className="pdf-hl-color-edit" title={t('pdf.highlight.pickColor')}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onChangeColor(hl.id, e.target.value)}
                    aria-label={t('pdf.highlight.pickColor')}
                  />
                </label>
                <div className="pdf-hl-mini-presets">
                  {HIGHLIGHT_PRESETS.slice(0, 6).map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`pdf-hl-swatch-hex is-mini${color === hex ? ' is-selected' : ''}`}
                      style={{ background: hex }}
                      aria-label={hex}
                      onClick={() => onChangeColor(hl.id, hex)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="pdf-hl-delete"
                  onClick={() => onDelete(hl.id)}
                  aria-label={t('pdf.highlight.delete')}
                >
                  ×
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
