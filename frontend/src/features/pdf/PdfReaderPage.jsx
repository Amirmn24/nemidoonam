import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi } from '../../shared/api'
import { useDocumentHighlights } from './hooks/useDocumentHighlights'
import { useSecurePdfSource } from './hooks/useSecurePdfSource'
import PdfHighlightTip from './components/PdfHighlightTip'
import PdfPageSidebar from './components/PdfPageSidebar'
import PdfReaderToolbar from './components/PdfReaderToolbar'
import PdfSmartViewer from './components/PdfSmartViewer'

function bumpScale(actualScale, delta) {
  const base = Number.isFinite(actualScale) && actualScale > 0 ? actualScale : 1
  const next = Math.round((base + delta) * 10) / 10
  return String(Math.min(3, Math.max(0.5, next)))
}

/**
 * صفحهٔ تمام‌صفحهٔ خواندن PDF برای منابع دیجیتال قفسه.
 */
export default function PdfReaderPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const viewerRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const [book, setBook] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [metaLoading, setMetaLoading] = useState(true)
  const [pdfDocument, setPdfDocument] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfScaleValue, setPdfScaleValue] = useState('page-width')
  const [actualScale, setActualScale] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [highlightMode, setHighlightMode] = useState(true)
  const [hlDraft, setHlDraft] = useState(null)
  const [hlError, setHlError] = useState('')

  const {
    highlights,
    error: highlightsLoadError,
    createHighlight,
    updateHighlightColor,
    removeHighlight,
  } = useDocumentHighlights(id)

  useEffect(() => {
    let cancelled = false
    setMetaLoading(true)
    setMetaError('')
    booksApi
      .detail(id)
      .then((data) => {
        if (cancelled) return
        setBook(data.book)
      })
      .catch((err) => {
        if (cancelled) return
        setMetaError(err.message || t('app.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, t])

  // فقط هنگام خروج از صفحه destroy — نه روی هر تغییر state (Strict Mode را می‌شکست)
  useEffect(() => {
    return () => {
      const doc = pdfDocumentRef.current
      pdfDocumentRef.current = null
      if (doc) {
        try {
          doc.destroy()
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  const hasDocument = Boolean(book?.document?.has_file || book?.document?.content_url)
  const { sourceUrl, loading: pdfLoading, error: pdfError } = useSecurePdfSource(
    hasDocument ? id : null,
  )

  const onScaleChange = useCallback((scale) => {
    if (Number.isFinite(scale) && scale > 0) setActualScale(scale)
  }, [])

  const onPageChange = useCallback((page, total) => {
    if (Number.isFinite(page)) setCurrentPage(page)
    if (Number.isFinite(total) && total > 0) setPageCount(total)
  }, [])

  const goToPage = useCallback((n) => {
    viewerRef.current?.goToPage(n)
  }, [])

  const onTextSelected = useCallback((payload, point) => {
    if (!highlightMode) {
      setHlDraft(null)
      return
    }
    if (!payload) {
      setHlDraft(null)
      return
    }
    setHlDraft({
      payload,
      x: point?.x || 0,
      y: point?.y || 0,
    })
  }, [highlightMode])

  const saveDraft = useCallback(
    async (color) => {
      if (!hlDraft?.payload) return
      setHlError('')
      try {
        await createHighlight({ ...hlDraft.payload, color })
        setHlDraft(null)
        window.getSelection()?.removeAllRanges()
      } catch (err) {
        setHlError(err.message || t('pdf.highlight.saveFailed'))
      }
    },
    [hlDraft, createHighlight, t],
  )

  const onDeleteHighlight = useCallback(
    async (highlightId) => {
      setHlError('')
      try {
        await removeHighlight(highlightId)
      } catch (err) {
        setHlError(err.message || t('pdf.highlight.saveFailed'))
      }
    },
    [removeHighlight, t],
  )

  const onChangeHighlightColor = useCallback(
    async (highlightId, color) => {
      setHlError('')
      try {
        await updateHighlightColor(highlightId, color)
      } catch (err) {
        setHlError(err.message || t('pdf.highlight.saveFailed'))
      }
    },
    [updateHighlightColor, t],
  )

  useEffect(() => {
    if (!highlightMode) setHlDraft(null)
  }, [highlightMode])

  useEffect(() => {
    if (!hlDraft) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setHlDraft(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hlDraft])

  const onDocumentLoad = useCallback((doc) => {
    const prev = pdfDocumentRef.current
    pdfDocumentRef.current = doc
    if (prev && prev !== doc) {
      try {
        prev.destroy()
      } catch {
        /* ignore */
      }
    }
    setPdfDocument(doc)
    setPageCount(doc.numPages)
    setCurrentPage(1)
  }, [])

  const scaleLabel = `${Math.round((actualScale || 1) * 100)}%`

  if (metaLoading) {
    return (
      <div className="pdf-reader-page">
        <p className="pdf-viewer-status">{t('app.loading')}</p>
      </div>
    )
  }

  if (metaError) {
    return (
      <div className="pdf-reader-page">
        <p className="form-errors">{metaError}</p>
        <Link to="/books" className="btn btn-ghost">
          {t('app.back')}
        </Link>
      </div>
    )
  }

  if (!book?.is_digital || !hasDocument) {
    return <Navigate to={`/books/${id}`} replace />
  }

  return (
    <div className={`pdf-reader-page${sidebarOpen ? ' has-sidebar' : ''}`}>
      <PdfReaderToolbar
        title={book.title}
        shelfId={id}
        kindLabel={
          book.resource_kind
            ? t(`books.resourceKind.${book.resource_kind}`, {
                defaultValue: book.resource_kind_display,
              })
            : null
        }
        currentPage={currentPage}
        pageCount={pageCount}
        scaleLabel={scaleLabel}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        highlightMode={highlightMode}
        highlightCount={highlights.length}
        onToggleHighlightMode={() => setHighlightMode((v) => !v)}
        onGoToPage={goToPage}
        onPrevPage={() => viewerRef.current?.prevPage()}
        onNextPage={() => viewerRef.current?.nextPage()}
        onZoomIn={() => setPdfScaleValue(bumpScale(actualScale, 0.15))}
        onZoomOut={() => setPdfScaleValue(bumpScale(actualScale, -0.15))}
        onFitWidth={() => setPdfScaleValue('page-width')}
        onFitAuto={() => setPdfScaleValue('auto')}
      />

      <div className="pdf-reader-stage">
        <PdfPageSidebar
          open={sidebarOpen}
          pdfDocument={pdfDocument}
          pageCount={pageCount}
          currentPage={currentPage}
          onSelectPage={goToPage}
          onClose={() => setSidebarOpen(false)}
          highlights={highlights}
          onDeleteHighlight={onDeleteHighlight}
          onChangeHighlightColor={onChangeHighlightColor}
        />

        <div className="pdf-reader-canvas">
          {pdfLoading ? <p className="pdf-viewer-status">{t('pdf.loadingDocument')}</p> : null}
          {pdfError ? (
            <div className="pdf-reader-error">
              <p className="form-errors">{pdfError}</p>
              <p className="form-hint">{t('pdf.secureHint')}</p>
            </div>
          ) : null}
          {hlError || highlightsLoadError ? (
            <p className="form-errors pdf-hl-banner">{hlError || highlightsLoadError}</p>
          ) : null}
          {!pdfLoading && !pdfError && sourceUrl ? (
            <PdfSmartViewer
              ref={viewerRef}
              sourceUrl={sourceUrl}
              pdfScaleValue={pdfScaleValue}
              highlights={highlights}
              highlightMode={highlightMode}
              onDocumentLoad={onDocumentLoad}
              onScaleChange={onScaleChange}
              onPageChange={onPageChange}
              onTextSelected={onTextSelected}
            />
          ) : null}
          <PdfHighlightTip
            draft={hlDraft}
            onPickColor={saveDraft}
            onCancel={() => setHlDraft(null)}
          />
        </div>
      </div>
    </div>
  )
}
