/**
 * قرارداد لایهٔ تعامل روی PDF — مختصات نرمال ۰–۱، مستقل از viewport.
 * فایل PDF هرگز بازنویسی نمی‌شود؛ فقط ردیف‌های هایلایت در API ذخیره می‌شوند.
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} PdfNormRect */

/**
 * @typedef {Object} StoredHighlight
 * @property {number} id
 * @property {number} page_number
 * @property {string} color
 * @property {string} quote
 * @property {PdfNormRect[]} rects
 */

/**
 * @typedef {Object} PdfLayerAdapters
 * @property {StoredHighlight[]} highlights
 * @property {(payload: { page_number: number, quote: string, rects: PdfNormRect[], color: string }) => void} [onCreateHighlight]
 * @property {(id: number, color: string) => void} [onUpdateHighlight]
 * @property {(id: number) => void} [onRemoveHighlight]
 */

export const EMPTY_HIGHLIGHTS = Object.freeze([])

/**
 * @param {Partial<PdfLayerAdapters>} [overrides]
 * @returns {PdfLayerAdapters}
 */
export function createEmptyLayerAdapters(overrides = {}) {
  return {
    highlights: EMPTY_HIGHLIGHTS,
    onCreateHighlight: undefined,
    onUpdateHighlight: undefined,
    onRemoveHighlight: undefined,
    ...overrides,
  }
}
