import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const THUMB_WIDTH = 112

/**
 * یک بند انگشتی با رندر تنبل (IntersectionObserver).
 */
function PdfThumbItem({ pdfDocument, pageNumber, active, onSelect }) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const itemRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = itemRef.current
    if (!node) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { root: node.closest('.pdf-page-sidebar-list'), rootMargin: '120px', threshold: 0.01 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !pdfDocument || !canvasRef.current) return undefined
    let cancelled = false

    ;(async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = THUMB_WIDTH / base.width
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { alpha: false })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await page.render({ canvasContext: ctx, viewport }).promise
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible, pdfDocument, pageNumber])

  useEffect(() => {
    if (!active || !itemRef.current) return
    itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <button
      ref={itemRef}
      type="button"
      className={`pdf-thumb-item${active ? ' is-active' : ''}`}
      onClick={() => onSelect(pageNumber)}
      aria-current={active ? 'page' : undefined}
      aria-label={t('pdf.nav.pageAria', { page: pageNumber })}
    >
      <span className="pdf-thumb-frame">
        {failed ? (
          <span className="pdf-thumb-fallback">{pageNumber}</span>
        ) : (
          <canvas ref={canvasRef} className="pdf-thumb-canvas" />
        )}
      </span>
      <span className="pdf-thumb-label">{pageNumber}</span>
    </button>
  )
}

/**
 * سایدبار ناوبری صفحه‌به‌صفحه با thumbnail.
 */
export default function PdfPageSidebar({
  open,
  pdfDocument,
  pageCount,
  currentPage,
  onSelectPage,
  onClose,
}) {
  const { t } = useTranslation()
  if (!open) return null

  const pages = pageCount > 0 ? Array.from({ length: pageCount }, (_, i) => i + 1) : []

  return (
    <aside className="pdf-page-sidebar" aria-label={t('pdf.nav.sidebar')}>
      <div className="pdf-page-sidebar-head">
        <strong>{t('pdf.nav.sidebar')}</strong>
        <button type="button" className="pdf-tool-btn pdf-tool-btn-label" onClick={onClose}>
          {t('app.close')}
        </button>
      </div>
      <div className="pdf-page-sidebar-list">
        {!pdfDocument || pages.length === 0 ? (
          <p className="pdf-viewer-status">{t('pdf.loadingDocument')}</p>
        ) : (
          pages.map((n) => (
            <PdfThumbItem
              key={n}
              pdfDocument={pdfDocument}
              pageNumber={n}
              active={n === currentPage}
              onSelect={onSelectPage}
            />
          ))
        )}
      </div>
    </aside>
  )
}
