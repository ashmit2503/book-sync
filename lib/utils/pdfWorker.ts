'use client'

import * as pdfjsLib from 'pdfjs-dist'

/** Configure PDF.js worker — call once before using any PDF.js APIs */
export function configurePDFWorker() {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  }
}

// Auto-configure on import
configurePDFWorker()

export { pdfjsLib }
