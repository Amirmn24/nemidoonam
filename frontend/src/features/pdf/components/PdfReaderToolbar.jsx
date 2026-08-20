import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useTheme } from '../../../shared/ThemeContext'
import { HIGHLIGHT_PRESETS, normalizeHighlightColor } from '../lib/highlightGeometry'
import PdfPageNav from './PdfPageNav'

/**
 * نوار خواننده + ابزار مداد هایلایت با پالت و RGB.
 */
export default function PdfReaderToolbar({
  title,
  shelfId,
  currentPage,
  pageCount,
  scaleLabel,
  sidebarOpen,
  highlightMode,
  highlightColor,
  onToggleSidebar,
  onToggleHighlightMode,
  onHighlightColorChange,
  onGoToPage,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onFitWidth,
}) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteRef = useRef(null)
  const color = normalizeHighlightColor(highlightColor)

  useEffect(() => {
    if (!paletteOpen) return undefined
    const onDoc = (event) => {
      if (!paletteRef.current?.contains(event.target)) setPaletteOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [paletteOpen])

  useEffect(() => {
    if (!highlightMode) setPaletteOpen(false)
  }, [highlightMode])

  return (
    <header className="pdf-reader-toolbar">
      <div className="pdf-reader-toolbar-start">
        <Link to={`/books/${shelfId}`} className="pdf-reader-back" aria-label={t('app.back')}>
          <span aria-hidden="true">→</span>
        </Link>
        <h1 className="pdf-reader-title">{title}</h1>
      </div>
      <div className="pdf-reader-toolbar-end">
        <button
          type="button"
          className={`pdf-tool-btn pdf-tool-btn-label${sidebarOpen ? ' is-active' : ''}`}
          onClick={onToggleSidebar}
          aria-pressed={sidebarOpen}
          title={t('pdf.nav.sidebar')}
        >
          {t('pdf.nav.menu')}
        </button>

        <div className="pdf-hl-tool" ref={paletteRef}>
          <button
            type="button"
            className={`pdf-tool-btn pdf-hl-pen${highlightMode ? ' is-active' : ''}`}
            onClick={onToggleHighlightMode}
            aria-pressed={highlightMode}
            title={t('pdf.highlight.modeHint')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04c.39-.39.39-1.02 0-1.41l-2.51-2.51a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2.01-1.66z"
              />
            </svg>
            <span
              className="pdf-hl-pen-swatch"
              style={{ background: color }}
              aria-hidden="true"
            />
          </button>
          {highlightMode ? (
            <button
              type="button"
              className={`pdf-tool-btn pdf-tool-btn-label${paletteOpen ? ' is-active' : ''}`}
              onClick={() => setPaletteOpen((v) => !v)}
              aria-expanded={paletteOpen}
              title={t('pdf.highlight.pickColor')}
            >
              {t('pdf.highlight.palette')}
            </button>
          ) : null}
          {highlightMode && paletteOpen ? (
            <div className="pdf-hl-palette" role="dialog" aria-label={t('pdf.highlight.pickColor')}>
              <div className="pdf-hl-palette-presets">
                {HIGHLIGHT_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`pdf-hl-swatch-hex${color === hex ? ' is-selected' : ''}`}
                    style={{ background: hex }}
                    aria-label={hex}
                    onClick={() => {
                      onHighlightColorChange(hex)
                      setPaletteOpen(false)
                    }}
                  />
                ))}
              </div>
              <label className="pdf-hl-palette-rgb">
                <span>{t('pdf.highlight.rgb')}</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onHighlightColorChange(e.target.value)}
                  aria-label={t('pdf.highlight.rgb')}
                />
              </label>
            </div>
          ) : null}
        </div>

        <PdfPageNav
          currentPage={currentPage}
          pageCount={pageCount}
          onGoToPage={onGoToPage}
          onPrev={onPrevPage}
          onNext={onNextPage}
        />
        <div className="pdf-reader-zoom-group" role="group" aria-label={t('pdf.toolbar.zoom')}>
          <button type="button" className="pdf-tool-btn" onClick={onZoomOut} title={t('pdf.toolbar.zoomOut')}>
            −
          </button>
          <button
            type="button"
            className="pdf-reader-scale"
            onClick={onFitWidth}
            title={t('pdf.toolbar.fitWidth')}
          >
            {scaleLabel}
          </button>
          <button type="button" className="pdf-tool-btn" onClick={onZoomIn} title={t('pdf.toolbar.zoomIn')}>
            +
          </button>
        </div>
        <button
          type="button"
          className="pdf-tool-btn pdf-tool-btn-label"
          onClick={toggleTheme}
          title={t('pdf.toolbar.toggleTheme')}
        >
          {theme === 'dark' ? t('pdf.toolbar.themeLight') : t('pdf.toolbar.themeDark')}
        </button>
      </div>
    </header>
  )
}
