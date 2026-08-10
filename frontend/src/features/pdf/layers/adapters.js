/**
 * قرارداد لایهٔ تعامل روی PDF — مستقل از viewport.
 * ذخیرهٔ سروری بعداً روی همین شکل سوار می‌شود.
 */

/** @typedef {import('react-pdf-highlighter').IHighlight} PdfHighlight */
/** @typedef {import('react-pdf-highlighter').NewHighlight} NewPdfHighlight */
/** @typedef {import('react-pdf-highlighter').ScaledPosition} ScaledPosition */

/**
 * @typedef {Object} PdfLayerAdapters
 * @property {PdfHighlight[]} highlights
 * @property {(highlight: NewPdfHighlight) => void} [onCreateHighlight]
 * @property {(id: string, position: Partial<ScaledPosition>, content: object) => void} [onUpdateHighlight]
 * @property {(id: string) => void} [onRemoveHighlight]
 */

export const EMPTY_HIGHLIGHTS = Object.freeze([])

/**
 * Adapter خالی — رفتار فعلی: فقط مشاهده.
 * فیچرهای بعدی (هایلایت، دکمه، نوت) این قرارداد را پر می‌کنند.
 * @returns {PdfLayerAdapters}
 */
export function createEmptyLayerAdapters() {
  return {
    highlights: EMPTY_HIGHLIGHTS,
    onCreateHighlight: undefined,
    onUpdateHighlight: undefined,
    onRemoveHighlight: undefined,
  }
}
