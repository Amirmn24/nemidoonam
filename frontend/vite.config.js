import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = dirname(fileURLToPath(import.meta.url))

function copyPdfjsAssets() {
  const copy = () => {
    const dest = resolve(root, 'dist/assets/pdfjs')
    mkdirSync(dest, { recursive: true })
    cpSync(resolve(root, 'node_modules/pdfjs-dist/cmaps'), resolve(dest, 'cmaps'), {
      recursive: true,
    })
    cpSync(
      resolve(root, 'node_modules/pdfjs-dist/standard_fonts'),
      resolve(dest, 'standard_fonts'),
      { recursive: true },
    )
  }
  return { name: 'copy-pdfjs-assets', writeBundle: copy }
}

export default defineConfig({
  plugins: [react(), copyPdfjsAssets()],
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdfjs-dist/web/pdf_viewer.mjs'],
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
})
