/**
 * Worker PDF.js از همان origin — بدون CDN خارجی (امنیت + آفلاین).
 * نسخه باید با dependencyی react-pdf-highlighter هم‌خوان باشد.
 */
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export const PDF_WORKER_SRC = workerUrl
