import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useTheme } from '../../../shared/ThemeContext'

/**
 * نوار ابزار خوانندهٔ ویروانا — هم‌رنگ با chrome پروژه.
 */
export default function PdfReaderToolbar({
  title,
  shelfId,
  kindLabel,
  pageLabel,
  scaleLabel,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitAuto,
}) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="pdf-reader-toolbar">
      <div className="pdf-reader-toolbar-start">
        <Link to={`/books/${shelfId}`} className="pdf-reader-back" aria-label={t('app.back')}>
          <span aria-hidden="true">→</span>
          <span>{t('app.back')}</span>
        </Link>
        <div className="pdf-reader-brand-chip" title="Vyrvona">
          <span className="pdf-reader-brand-mark" aria-hidden="true" />
          <span>{t('pdf.brandReader')}</span>
        </div>
        <div className="pdf-reader-title-block">
          <h1 className="pdf-reader-title">{title}</h1>
          <div className="pdf-reader-submeta">
            {kindLabel ? <span className="pdf-reader-kind">{kindLabel}</span> : null}
            {pageLabel ? <span className="pdf-reader-meta">{pageLabel}</span> : null}
          </div>
        </div>
      </div>
      <div className="pdf-reader-toolbar-end">
        <div className="pdf-reader-zoom-group" role="group" aria-label={t('pdf.toolbar.zoom')}>
          <button type="button" className="pdf-tool-btn" onClick={onZoomOut} title={t('pdf.toolbar.zoomOut')}>
            −
          </button>
          <span className="pdf-reader-scale">{scaleLabel}</span>
          <button type="button" className="pdf-tool-btn" onClick={onZoomIn} title={t('pdf.toolbar.zoomIn')}>
            +
          </button>
          <button type="button" className="pdf-tool-btn pdf-tool-btn-label" onClick={onFitWidth}>
            {t('pdf.toolbar.fitWidth')}
          </button>
          {onFitAuto ? (
            <button type="button" className="pdf-tool-btn pdf-tool-btn-label" onClick={onFitAuto}>
              {t('pdf.toolbar.scale.auto')}
            </button>
          ) : null}
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
