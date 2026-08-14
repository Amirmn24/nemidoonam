/**
 * مختصات هایلایت نرمال ۰–۱ نسبت به canvas صفحه — مستقل از زوم.
 */

export const HIGHLIGHT_COLORS = ['yellow', 'lime', 'sky', 'rose']

const MAX_RECTS = 48

function closestPage(node) {
  if (!node) return null
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
  return el?.closest('.page') || null
}

function clampRect(r) {
  const x = Math.min(1, Math.max(0, r.x))
  const y = Math.min(1, Math.max(0, r.y))
  const w = Math.min(1 - x, Math.max(0, r.w))
  const h = Math.min(1 - y, Math.max(0, r.h))
  return { x, y, w, h }
}

function mergeLineRects(rects) {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const out = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    const sameLine =
      last &&
      Math.abs(last.y - r.y) < 0.008 &&
      Math.abs(last.h - r.h) < 0.012 &&
      r.x <= last.x + last.w + 0.016
    if (sameLine) {
      const right = Math.max(last.x + last.w, r.x + r.w)
      const bottom = Math.max(last.y + last.h, r.y + r.h)
      last.x = Math.min(last.x, r.x)
      last.y = Math.min(last.y, r.y)
      last.w = right - last.x
      last.h = bottom - last.y
    } else {
      out.push({ ...r })
    }
  }
  return out.slice(0, MAX_RECTS)
}

/**
 * انتخاب متن لایهٔ pdf.js را به payload ذخیره تبدیل می‌کند.
 * @returns {{ page_number: number, quote: string, rects: {x:number,y:number,w:number,h:number}[] } | null}
 */
export function captureTextSelection(rootEl) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount || !rootEl) return null
  if (!rootEl.contains(sel.anchorNode)) return null

  const range = sel.getRangeAt(0)
  const startPage = closestPage(range.startContainer)
  const endPage = closestPage(range.endContainer)
  if (!startPage || startPage !== endPage || !rootEl.contains(startPage)) return null

  const boxEl = startPage.querySelector('.canvasWrapper') || startPage
  const box = boxEl.getBoundingClientRect()
  if (box.width < 2 || box.height < 2) return null

  const rects = []
  for (const r of range.getClientRects()) {
    if (r.width < 2 || r.height < 2) continue
    if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) {
      continue
    }
    rects.push(
      clampRect({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
      }),
    )
  }
  const merged = mergeLineRects(rects.filter((r) => r.w >= 0.002 && r.h >= 0.002))
  if (!merged.length) return null

  const pageNumber = Number(startPage.dataset.pageNumber)
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return null

  const clientRects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1)
  const bounds = clientRects.length
    ? {
        left: Math.min(...clientRects.map((r) => r.left)),
        top: Math.min(...clientRects.map((r) => r.top)),
        right: Math.max(...clientRects.map((r) => r.right)),
        bottom: Math.max(...clientRects.map((r) => r.bottom)),
      }
    : boxEl.getBoundingClientRect()

  return {
    kind: 'text',
    page_number: pageNumber,
    quote: sel.toString().replace(/\s+/g, ' ').trim(),
    rects: merged,
    bounds,
  }
}

function ensureLayer(pageEl) {
  const host = pageEl.querySelector('.canvasWrapper') || pageEl
  let layer = host.querySelector(':scope > .pdf-hl-layer')
  if (layer) return layer
  layer = document.createElement('div')
  layer.className = 'pdf-hl-layer'
  host.appendChild(layer)
  return layer
}

/**
 * هایلایت‌های ذخیره‌شده را روی صفحات رندرشدهٔ pdf.js می‌کشد.
 */
export function paintHighlightLayers(root, highlights) {
  if (!root) return
  const items = Array.isArray(highlights) ? highlights : []
  root.querySelectorAll('.page').forEach((pageEl) => {
    const layer = ensureLayer(pageEl)
    const pageNumber = Number(pageEl.dataset.pageNumber)
    const pageItems = items.filter((h) => Number(h.page_number) === pageNumber)
    layer.replaceChildren()
    for (const hl of pageItems) {
      const group = document.createElement('div')
      group.className = 'pdf-hl-group'
      group.dataset.hlId = String(hl.id)
      for (const r of hl.rects || []) {
        const el = document.createElement('i')
        el.className = `pdf-hl-rect pdf-hl-${hl.color || 'yellow'}`
        el.style.left = `${(Number(r.x) || 0) * 100}%`
        el.style.top = `${(Number(r.y) || 0) * 100}%`
        el.style.width = `${(Number(r.w) || 0) * 100}%`
        el.style.height = `${(Number(r.h) || 0) * 100}%`
        group.appendChild(el)
      }
      layer.appendChild(group)
    }
  })
}
