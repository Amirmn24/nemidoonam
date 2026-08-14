import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useTheme } from '../../../shared/ThemeContext'
import PdfPageNav from './PdfPageNav'

/**
 * نوار باریک خواننده — برگشت، عنوان، فهرست، صفحه، زوم.
 */
export default function PdfReaderToolbar({
  title,
  shelfId,
  currentPage,
  pageCount,
  scaleLabel,
  sidebarOpen,
  onToggleSidebar,
  onGoToPage,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onFitWidth,
}) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()

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
