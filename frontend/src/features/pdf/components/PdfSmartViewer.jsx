import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
} from 'react-pdf-highlighter'
import 'react-pdf-highlighter/dist/style.css'

import { PDF_WORKER_SRC } from '../lib/pdfWorker'
import { createEmptyLayerAdapters } from '../layers/adapters'

/**
 * Smart Viewer پایه (pdf.js + لایهٔ تعامل).
 *
 * - `sourceUrl` باید Object URL امن از useSecurePdfSource باشد
 * - `layerAdapters` قرارداد هایلایت/دکمه برای فیچرهای بعدی است
 */
export default function PdfSmartViewer({
  sourceUrl,
  layerAdapters,
  pdfScaleValue = 'auto',
  onDocumentLoad,
}) {
  const { t } = useTranslation()
  const adapters = layerAdapters || createEmptyLayerAdapters()
  const highlights = adapters.highlights || []
  const loadedDocRef = useRef(null)
  const scrollRef = useRef(() => {})

  const handleSelectionFinished = useCallback(
    (position, content, hideTipAndSelection) => {
      if (!adapters.onCreateHighlight) {
        hideTipAndSelection()
        return null
      }
      adapters.onCreateHighlight({
        content,
        position,
        comment: { text: '', emoji: '' },
      })
      hideTipAndSelection()
      return null
    },
    [adapters],
  )

  const highlightTransform = useCallback(
    (highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => {
      const isTextHighlight = !highlight.content?.image
      const component = isTextHighlight ? (
        <Highlight
          isScrolledTo={isScrolledTo}
          position={highlight.position}
          comment={highlight.comment}
        />
      ) : (
        <AreaHighlight
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          onChange={(boundingRect) => {
            adapters.onUpdateHighlight?.(
              highlight.id,
              { boundingRect: viewportToScaled(boundingRect) },
              { image: screenshot(boundingRect) },
            )
          }}
        />
      )

      const popup = highlight.comment?.text ? (
        <div className="pdf-highlight-popup">
          {highlight.comment.emoji ? <span>{highlight.comment.emoji} </span> : null}
          {highlight.comment.text}
        </div>
      ) : null

      return (
        <Popup
          popupContent={popup}
          onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
          onMouseOut={hideTip}
          key={highlight.id || index}
        >
          {component}
        </Popup>
      )
    },
    [adapters],
  )

  if (!sourceUrl) return null

  return (
    <div className="pdf-smart-viewer">
      <PdfLoader
        url={sourceUrl}
        workerSrc={PDF_WORKER_SRC}
        beforeLoad={<p className="pdf-viewer-status">{t('pdf.loadingDocument')}</p>}
        errorMessage={<p className="form-errors">{t('pdf.loadFailed')}</p>}
      >
        {(pdfDocument) => {
          if (loadedDocRef.current !== pdfDocument) {
            loadedDocRef.current = pdfDocument
            queueMicrotask(() => onDocumentLoad?.(pdfDocument))
          }
          return (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              pdfScaleValue={pdfScaleValue}
              enableAreaSelection={() => Boolean(adapters.onCreateHighlight)}
              onScrollChange={() => {}}
              scrollRef={(scrollTo) => {
                scrollRef.current = scrollTo
              }}
              onSelectionFinished={handleSelectionFinished}
              highlightTransform={highlightTransform}
              highlights={highlights}
            />
          )
        }}
      </PdfLoader>
    </div>
  )
}
