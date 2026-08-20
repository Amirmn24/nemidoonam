import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi } from '../../shared/api'
import { useDocumentHighlights } from './hooks/useDocumentHighlights'
import { useSecurePdfSource } from './hooks/useSecurePdfSource'
import { DEFAULT_HIGHLIGHT_COLOR, normalizeHighlightColor } from './lib/highlightGeometry'
import { copyPageImageBlob, writeClipboardPng, writeClipboardText } from './lib/pdfImages'
import PdfHighlightTip from './components/PdfHighlightTip'
import PdfNoteTip from './components/PdfNoteTip'
import PdfPageSidebar from './components/PdfPageSidebar'
import PdfReaderToolbar from './components/PdfReaderToolbar'
import PdfSmartViewer from './components/PdfSmartViewer'

const COLOR_STORAGE_KEY = 'vyrvona.pdf.highlightColor'

function bumpScale(actualScale, delta) {
  const base = Number.isFinite(actualScale) && actualScale > 0 ? actualScale : 1
  const next = Math.round((base + delta) * 10) / 10
  return String(Math.min(3, Math.max(0.5, next)))
}

function readStoredColor() {
  try {
    return normalizeHighlightColor(localStorage.getItem(COLOR_STORAGE_KEY) || DEFAULT_HIGHLIGHT_COLOR)
  } catch {
    return DEFAULT_HIGHLIGHT_COLOR
  }
}

/**
 * صفحهٔ تمام‌صفحهٔ خواندن PDF برای منابع دیجیتال قفسه.
 */
export default function PdfReaderPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const viewerRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const highlightModeRef = useRef(false)
  const highlightColorRef = useRef(DEFAULT_HIGHLIGHT_COLOR)
  const [book, setBook] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [metaLoading, setMetaLoading] = useState(true)
  const [pdfDocument, setPdfDocument] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfScaleValue, setPdfScaleValue] = useState('page-width')
  const [actualScale, setActualScale] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [highlightMode, setHighlightMode] = useState(false)
  const [highlightColor, setHighlightColor] = useState(readStoredColor)
  const [hlDraft, setHlDraft] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [copied, setCopied] = useState(false)
  const [hlError, setHlError] = useState('')

  highlightModeRef.current = highlightMode
  highlightColorRef.current = highlightColor

  const {
    highlights,
    error: highlightsLoadError,
    createHighlight,
    updateHighlightColor,
    updateHighlightNote,
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

  const setColor = useCallback((value) => {
    const next = normalizeHighlightColor(value)
    setHighlightColor(next)
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const onTextSelected = useCallback(
    async (payload) => {
      setCopied(false)
      if (!payload) {
        setHlDraft(null)
        return
      }

      // ابزار مداد روشن: انتخاب متن → هایلایت فوری با رنگ فعلی
      if (payload.kind === 'text' && highlightModeRef.current) {
        setHlDraft(null)
        setHlError('')
        try {
          const created = await createHighlight({
            page_number: payload.page_number,
            quote: payload.quote || '',
            rects: payload.rects,
            color: highlightColorRef.current,
          })
          window.getSelection()?.removeAllRanges()
          setNoteTarget({
            id: created.id,
            note: created.note || '',
            bounds: payload.bounds,
          })
        } catch (err) {
          setHlError(err.message || t('pdf.highlight.saveFailed'))
        }
        return
      }

      setNoteTarget(null)
      setHlDraft(payload)
    },
    [createHighlight, t],
  )

  const copyDraft = useCallback(async () => {
    if (!hlDraft) return
    setHlError('')
    try {
      if (hlDraft.kind === 'image') {
        const page = await pdfDocumentRef.current?.getPage(hlDraft.page_number)
        const pageEl = document.querySelector(
          `.pdf-viewer-container .page[data-page-number="${hlDraft.page_number}"]`,
        )
        const rect = hlDraft.rects?.[0]
        const blob = await copyPageImageBlob(page, pageEl, {
          name: hlDraft.imageName || '',
          x: rect?.x || 0,
          y: rect?.y || 0,
          w: rect?.w || 1,
          h: rect?.h || 1,
        })
        await writeClipboardPng(blob)
      } else {
        await writeClipboardText(hlDraft.quote || '')
      }
      setCopied(true)
    } catch {
      setHlError(t('pdf.highlight.copyFailed'))
    }
  }, [hlDraft, t])

  const onDeleteHighlight = useCallback(
    async (highlightId) => {
      setHlError('')
      try {
        await removeHighlight(highlightId)
        setNoteTarget((prev) => (prev?.id === highlightId ? null : prev))
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

  const onChangeHighlightNote = useCallback(
    async (highlightId, note) => {
      setHlError('')
      try {
        await updateHighlightNote(highlightId, note)
      } catch (err) {
        setHlError(err.message || t('pdf.highlight.saveFailed'))
      }
    },
    [updateHighlightNote, t],
  )

  const saveNoteTip = useCallback(
    async (note) => {
      if (!noteTarget?.id) return
      try {
        await updateHighlightNote(noteTarget.id, note)
        setNoteTarget(null)
      } catch (err) {
        setHlError(err.message || t('pdf.highlight.saveFailed'))
      }
    },
    [noteTarget, updateHighlightNote, t],
  )

  useEffect(() => {
    if (!hlDraft && !noteTarget) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setHlDraft(null)
        setNoteTarget(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hlDraft, noteTarget])

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
    <div className={`pdf-reader-page${sidebarOpen ? ' has-sidebar' : ''}${highlightMode ? ' is-hl-mode' : ''}`}>
      <PdfReaderToolbar
        title={book.title}
        shelfId={id}
        currentPage={currentPage}
        pageCount={pageCount}
        scaleLabel={scaleLabel}
        sidebarOpen={sidebarOpen}
        highlightMode={highlightMode}
        highlightColor={highlightColor}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleHighlightMode={() => setHighlightMode((v) => !v)}
        onHighlightColorChange={setColor}
        onGoToPage={goToPage}
        onPrevPage={() => viewerRef.current?.prevPage()}
        onNextPage={() => viewerRef.current?.nextPage()}
        onZoomIn={() => setPdfScaleValue(bumpScale(actualScale, 0.15))}
        onZoomOut={() => setPdfScaleValue(bumpScale(actualScale, -0.15))}
        onFitWidth={() => setPdfScaleValue('page-width')}
      />

      <div className="pdf-reader-stage">
        <PdfPageSidebar
          open={sidebarOpen}
          pdfDocument={pdfDocument}
          pageCount={pageCount}
          currentPage={currentPage}
          onSelectPage={goToPage}
          highlights={highlights}
          onDeleteHighlight={onDeleteHighlight}
          onChangeHighlightColor={onChangeHighlightColor}
          onChangeHighlightNote={onChangeHighlightNote}
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
              activeImageKey={hlDraft?.kind === 'image' ? hlDraft.imageKey : ''}
              onDocumentLoad={onDocumentLoad}
              onScaleChange={onScaleChange}
              onPageChange={onPageChange}
              onTextSelected={onTextSelected}
            />
          ) : null}
          <PdfHighlightTip draft={hlDraft} copied={copied} onCopy={copyDraft} />
          <PdfNoteTip
            target={noteTarget}
            onSave={saveNoteTip}
            onSkip={() => setNoteTarget(null)}
          />
        </div>
      </div>
    </div>
  )
}
