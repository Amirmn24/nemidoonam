import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi } from '../../shared/api'
import { useSecurePdfSource } from './hooks/useSecurePdfSource'
import { createEmptyLayerAdapters } from './layers/adapters'
import PdfReaderToolbar from './components/PdfReaderToolbar'
import PdfSmartViewer from './components/PdfSmartViewer'

function nextScale(prev, delta) {
  const n = Number(prev)
  const base = Number.isFinite(n) ? n : 1
  const next = Math.round((base + delta) * 10) / 10
  return String(Math.min(3, Math.max(0.5, next)))
}

/**
 * صفحهٔ تمام‌صفحهٔ خواندن PDF برای منابع دیجیتال قفسه.
 * AuthZ واقعی روی API محتواست؛ اینجا فقط مالک از detail قفسه می‌آید.
 */
export default function PdfReaderPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [book, setBook] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [metaLoading, setMetaLoading] = useState(true)
  const [pageCount, setPageCount] = useState(null)
  const [pdfScaleValue, setPdfScaleValue] = useState('page-width')

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

  const hasDocument = Boolean(book?.document?.has_file || book?.document?.content_url)
  const { sourceUrl, loading: pdfLoading, error: pdfError } = useSecurePdfSource(
    hasDocument ? id : null,
  )

  const layerAdapters = useMemo(() => createEmptyLayerAdapters(), [])

  const scaleLabel =
    pdfScaleValue === 'auto' || pdfScaleValue === 'page-width'
      ? t(`pdf.toolbar.scale.${pdfScaleValue === 'page-width' ? 'pageWidth' : 'auto'}`)
      : `${Math.round(Number(pdfScaleValue) * 100)}%`

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
    <div className="pdf-reader-page">
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
        pageLabel={
          pageCount
            ? t('pdf.toolbar.pages', { count: pageCount })
            : t('books.list.progressLabel', {
                current: book.current_page,
                total: book.total_pages,
                percent: book.progress_percent,
              })
        }
        scaleLabel={scaleLabel}
        onZoomIn={() => setPdfScaleValue((s) => nextScale(s, 0.1))}
        onZoomOut={() => setPdfScaleValue((s) => nextScale(s, -0.1))}
        onFitWidth={() => setPdfScaleValue('page-width')}
        onFitAuto={() => setPdfScaleValue('auto')}
      />

      <div className="pdf-reader-stage">
        <div className="pdf-reader-canvas">
          {pdfLoading ? <p className="pdf-viewer-status">{t('pdf.loadingDocument')}</p> : null}
          {pdfError ? (
            <div className="pdf-reader-error">
              <p className="form-errors">{pdfError}</p>
              <p className="form-hint">{t('pdf.secureHint')}</p>
            </div>
          ) : null}
          {!pdfLoading && !pdfError && sourceUrl ? (
            <PdfSmartViewer
              sourceUrl={sourceUrl}
              layerAdapters={layerAdapters}
              pdfScaleValue={pdfScaleValue}
              onDocumentLoad={(doc) => setPageCount(doc.numPages)}
            />
          ) : null}
        </div>
        <p className="pdf-reader-footnote">{t('pdf.baseModeHint')}</p>
      </div>
    </div>
  )
}
