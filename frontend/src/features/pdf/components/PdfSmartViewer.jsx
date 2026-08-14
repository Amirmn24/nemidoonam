import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import { EventBus, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'

import { captureTextSelection, paintHighlightLayers } from '../lib/highlightGeometry'
import {
  extractPageImages,
  hitPageImage,
  imageHitKey,
  paintImageHits,
  rectToClientBounds,
} from '../lib/pdfImages'
import { PDF_CMAP_URL, PDF_STANDARD_FONT_URL, PDF_WORKER_SRC } from '../lib/pdfWorker'

GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC

const TEXT_LAYER_ENABLE = 1
const ANNOTATION_DISABLE = 0

/**
 * Smart Viewer با PDF.js — لایهٔ متن LTR برای انتخاب/کپی، مستقل از RTL اپ.
 */
const PdfSmartViewer = forwardRef(function PdfSmartViewer(
  {
    sourceUrl,
    pdfScaleValue = 'page-width',
    highlights = [],
    activeImageKey = '',
    onDocumentLoad,
    onScaleChange,
    onPageChange,
    onTextSelected,
  },
  ref,
) {
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const scalePropRef = useRef(pdfScaleValue)
  const callbacksRef = useRef({ onDocumentLoad, onScaleChange, onPageChange, onTextSelected })
  const highlightsRef = useRef(highlights)
  const imageCacheRef = useRef(new Map())
  const downRef = useRef(null)
  const [bootError, setBootError] = useState('')
  const [viewerReady, setViewerReady] = useState(false)

  scalePropRef.current = pdfScaleValue
  highlightsRef.current = highlights
  callbacksRef.current = { onDocumentLoad, onScaleChange, onPageChange, onTextSelected }

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
    let resizeTimer = 0
    let lastWidth = 0
    setBootError('')
    setViewerReady(false)

    container.innerHTML = ''
    imageCacheRef.current = new Map()
    const viewerDiv = document.createElement('div')
    viewerDiv.className = 'pdfViewer'
    viewerDiv.setAttribute('dir', 'ltr')
    container.appendChild(viewerDiv)

    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus, externalLinkTarget: 2 })
    const viewer = new PDFViewer({
      container,
      viewer: viewerDiv,
      eventBus,
      linkService,
      textLayerMode: TEXT_LAYER_ENABLE,
      annotationMode: ANNOTATION_DISABLE,
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
      requestAnimationFrame(() => {
        if (cancelled) return
        lastWidth = container.clientWidth
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
        const width = container.clientWidth
        if (Math.abs(width - lastWidth) < 2) return
        lastWidth = width
        window.clearTimeout(resizeTimer)
        resizeTimer = window.setTimeout(() => {
          if (cancelled) return
          applyScale()
        }, 160)
      })
      resizeObserver.observe(container)
    }

    const loadingTask = getDocument({
      url: sourceUrl,
      withCredentials: false,
      cMapUrl: PDF_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: PDF_STANDARD_FONT_URL,
    })

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
      window.clearTimeout(resizeTimer)
      eventBus.off('pagesinit', onPagesInit)
      eventBus.off('scalechanging', onScaleChanging)
      eventBus.off('pagechanging', onPageChanging)
      resizeObserver?.disconnect()
      try {
        viewer.setDocument(null)
      } catch {
        /* ignore */
      }
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

  useEffect(() => {
    const viewer = viewerRef.current
    const container = containerRef.current
    if (!viewer || !viewerReady || !container) return undefined

    const paintPage = async (pageNumber) => {
      const pageEl = container.querySelector(`.page[data-page-number="${pageNumber}"]`)
      if (!pageEl) return
      paintHighlightLayers(container, highlightsRef.current)
      const doc = viewer.pdfDocument
      if (!doc) return
      let images = imageCacheRef.current.get(pageNumber)
      if (!images) {
        try {
          const page = await doc.getPage(pageNumber)
          images = await extractPageImages(page)
          imageCacheRef.current.set(pageNumber, images)
        } catch {
          images = []
        }
      }
      paintImageHits(pageEl, images, activeImageKey)
    }

    const onPageRendered = (evt) => {
      paintPage(evt.pageNumber)
    }
    const onTextLayer = (evt) => {
      paintHighlightLayers(container, highlightsRef.current)
      const pageEl = container.querySelector(`.page[data-page-number="${evt.pageNumber}"]`)
      const images = imageCacheRef.current.get(evt.pageNumber) || []
      if (pageEl) paintImageHits(pageEl, images, activeImageKey)
    }

    viewer.eventBus.on('pagerendered', onPageRendered)
    viewer.eventBus.on('textlayerrendered', onTextLayer)
    container.querySelectorAll('.page[data-page-number]').forEach((pageEl) => {
      paintPage(Number(pageEl.dataset.pageNumber))
    })
    return () => {
      viewer.eventBus.off('pagerendered', onPageRendered)
      viewer.eventBus.off('textlayerrendered', onTextLayer)
    }
  }, [viewerReady, activeImageKey])

  useEffect(() => {
    if (!viewerReady) return
    paintHighlightLayers(containerRef.current, highlights)
  }, [highlights, viewerReady])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !viewerReady) return undefined

    const onDown = (event) => {
      const point = event.changedTouches?.[0] || event
      downRef.current = { x: point.clientX, y: point.clientY }
    }

    const onUp = (event) => {
      if (event.target?.closest?.('.pdf-hl-tip, .pdf-sel-copy')) return
      const touch = event.changedTouches?.[0]
      const point = {
        x: event.clientX ?? touch?.clientX ?? 0,
        y: event.clientY ?? touch?.clientY ?? 0,
      }
      const down = downRef.current
      const dragged =
        down && Math.abs(point.x - down.x) + Math.abs(point.y - down.y) > 6
      window.setTimeout(() => {
        const text = captureTextSelection(container)
        if (text) {
          callbacksRef.current.onTextSelected?.(text)
          return
        }
        if (dragged) {
          callbacksRef.current.onTextSelected?.(null)
          return
        }
        const pageEl = document.elementFromPoint(point.x, point.y)?.closest?.('.page')
        const pageNumber = Number(pageEl?.dataset?.pageNumber)
        const images = Number.isFinite(pageNumber)
          ? imageCacheRef.current.get(pageNumber) || []
          : []
        const hit = pageEl ? hitPageImage(pageEl, images, point.x, point.y) : null
        if (hit && pageEl) {
          callbacksRef.current.onTextSelected?.({
            kind: 'image',
            page_number: pageNumber,
            quote: '',
            rects: [{ x: hit.x, y: hit.y, w: hit.w, h: hit.h }],
            imageName: hit.name || '',
            imageKey: imageHitKey(hit),
            bounds: rectToClientBounds(pageEl, hit),
          })
          return
        }
        callbacksRef.current.onTextSelected?.(null)
      }, 10)
    }

    container.addEventListener('mousedown', onDown)
    container.addEventListener('touchstart', onDown, { passive: true })
    container.addEventListener('mouseup', onUp)
    container.addEventListener('touchend', onUp, { passive: true })
    return () => {
      container.removeEventListener('mousedown', onDown)
      container.removeEventListener('touchstart', onDown)
      container.removeEventListener('mouseup', onUp)
      container.removeEventListener('touchend', onUp)
    }
  }, [viewerReady])

  return (
    <div className="pdf-smart-viewer">
      {bootError ? <p className="form-errors pdf-viewer-status">{bootError}</p> : null}
      <div ref={containerRef} className="pdf-viewer-container" dir="ltr" lang="en" />
    </div>
  )
})

export default PdfSmartViewer
