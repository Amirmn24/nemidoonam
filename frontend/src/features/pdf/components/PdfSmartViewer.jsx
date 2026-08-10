import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import { EventBus, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'

import { PDF_WORKER_SRC } from '../lib/pdfWorker'

GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC

/**
 * Smart Viewer با PDF.js — زوم و پرش صفحه از بیرون کنترل می‌شود.
 */
const PdfSmartViewer = forwardRef(function PdfSmartViewer(
  {
    sourceUrl,
    pdfScaleValue = 'page-width',
    onDocumentLoad,
    onScaleChange,
    onPageChange,
  },
  ref,
) {
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const scalePropRef = useRef(pdfScaleValue)
  const callbacksRef = useRef({ onDocumentLoad, onScaleChange, onPageChange })
  const [bootError, setBootError] = useState('')
  const [viewerReady, setViewerReady] = useState(false)

  scalePropRef.current = pdfScaleValue
  callbacksRef.current = { onDocumentLoad, onScaleChange, onPageChange }

  useImperativeHandle(
    ref,
    () => {
      const goToPage = (pageNumber) => {
        const viewer = viewerRef.current
        if (!viewer || !viewer.pagesCount) return
        const n = Number(pageNumber)
        if (!Number.isFinite(n)) return
        const clamped = Math.min(Math.max(1, Math.round(n)), viewer.pagesCount)
        viewer.currentPageNumber = clamped
      }
      return {
        goToPage,
        nextPage() {
          const viewer = viewerRef.current
          if (!viewer) return
          goToPage(viewer.currentPageNumber + 1)
        },
        prevPage() {
          const viewer = viewerRef.current
          if (!viewer) return
          goToPage(viewer.currentPageNumber - 1)
        },
        getCurrentPage() {
          return viewerRef.current?.currentPageNumber || 1
        },
        getPageCount() {
          return viewerRef.current?.pagesCount || 0
        },
      }
    },
    [viewerReady],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || !sourceUrl) return undefined

    let cancelled = false
    let resizeObserver = null
    setBootError('')
    setViewerReady(false)

    container.innerHTML = ''
    const viewerDiv = document.createElement('div')
    viewerDiv.className = 'pdfViewer'
    container.appendChild(viewerDiv)

    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus, externalLinkTarget: 2 })
    const viewer = new PDFViewer({
      container,
      viewer: viewerDiv,
      eventBus,
      linkService,
      textLayerMode: 2,
      removePageBorders: true,
    })
    linkService.setViewer(viewer)
    viewerRef.current = viewer

    const applyScale = () => {
      try {
        if (!container.clientWidth || !container.clientHeight) return
        viewer.currentScaleValue = String(scalePropRef.current || 'page-width')
        callbacksRef.current.onScaleChange?.(viewer.currentScale)
      } catch {
        /* ignore */
      }
    }

    const onPagesInit = () => {
      if (cancelled) return
      // بعد از layout واقعی — وگرنه page-width با عرض ۰ می‌میرد
      requestAnimationFrame(() => {
        if (cancelled) return
        applyScale()
        setViewerReady(true)
        callbacksRef.current.onPageChange?.(
          viewer.currentPageNumber || 1,
          viewer.pagesCount || 0,
        )
      })
    }

    const onScaleChanging = (evt) => {
      if (cancelled) return
      callbacksRef.current.onScaleChange?.(evt.scale)
    }

    const onPageChanging = (evt) => {
      if (cancelled) return
      callbacksRef.current.onPageChange?.(evt.pageNumber, viewer.pagesCount || 0)
    }

    eventBus.on('pagesinit', onPagesInit)
    eventBus.on('scalechanging', onScaleChanging)
    eventBus.on('pagechanging', onPageChanging)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (cancelled || !viewer.pagesCount) return
        applyScale()
      })
      resizeObserver.observe(container)
    }

    const loadingTask = getDocument({ url: sourceUrl, withCredentials: false })

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          try {
            doc.destroy()
          } catch {
            /* ignore */
          }
          return
        }
        linkService.setDocument(doc)
        viewer.setDocument(doc)
        callbacksRef.current.onDocumentLoad?.(doc)
      })
      .catch((err) => {
        if (cancelled) return
        setBootError(err?.message || t('pdf.loadFailed'))
      })

    return () => {
      cancelled = true
      eventBus.off('pagesinit', onPagesInit)
      eventBus.off('scalechanging', onScaleChanging)
      eventBus.off('pagechanging', onPageChanging)
      resizeObserver?.disconnect()
      try {
        viewer.setDocument(null)
      } catch {
        /* ignore */
      }
      // سند را اینجا destroy نکن — متعلق به صفحهٔ والد / سایدبار است
      viewerRef.current = null
      setViewerReady(false)
      container.innerHTML = ''
    }
  }, [sourceUrl, t])

  useEffect(() => {
    const viewer = viewerRef.current
    const container = containerRef.current
    if (!viewer || !viewerReady || !container) return
    if (!container.clientWidth || !container.clientHeight) return
    try {
      viewer.currentScaleValue = String(pdfScaleValue)
      callbacksRef.current.onScaleChange?.(viewer.currentScale)
    } catch (err) {
      console.warn('[pdf] scale apply failed', err)
    }
  }, [pdfScaleValue, viewerReady])

  return (
    <div className="pdf-smart-viewer">
      {bootError ? <p className="form-errors pdf-viewer-status">{bootError}</p> : null}
      <div ref={containerRef} className="pdf-viewer-container" />
    </div>
  )
})

export default PdfSmartViewer
