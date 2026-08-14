/**
 * Worker PDF.js از همان origin — بدون CDN خارجی (امنیت + آفلاین).
 */
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export const PDF_WORKER_SRC = workerUrl

/** cmap و فونت استاندارد — Django این مسیر را از dist/assets سرو می‌کند. */
export const PDF_CMAP_URL = '/assets/pdfjs/cmaps/'
export const PDF_STANDARD_FONT_URL = '/assets/pdfjs/standard_fonts/'
