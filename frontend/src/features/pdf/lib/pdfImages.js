import { ImageKind, OPS, Util } from 'pdfjs-dist'

const IDENTITY = [1, 0, 0, 1, 0, 0]

function unitSquareToNormRect(ctm, viewport) {
  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].map(([x, y]) => {
    const px = ctm[0] * x + ctm[2] * y + ctm[4]
    const py = ctm[1] * x + ctm[3] * y + ctm[5]
    return viewport.convertToViewportPoint(px, py)
  })
  const xs = corners.map((p) => p[0])
  const ys = corners.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = (maxX - minX) / viewport.width
  const h = (maxY - minY) / viewport.height
  return {
    x: minX / viewport.width,
    y: minY / viewport.height,
    w,
    h,
  }
}

function isUsefulImage(rect) {
  if (!rect) return false
  if (rect.w < 0.018 || rect.h < 0.018) return false
  if (rect.w * rect.h < 0.0007) return false
  if (rect.x + rect.w < 0 || rect.y + rect.h < 0) return false
  if (rect.x > 1 || rect.y > 1) return false
  return true
}

/**
 * تصاویر XObject صفحه را با مختصات نرمال ۰–۱ (منشأ بالا-چپ، مثل canvas) برمی‌گرداند.
 */
export async function extractPageImages(page) {
  const ops = await page.getOperatorList()
  const viewport = page.getViewport({ scale: 1 })
  const images = []
  const stack = []
  let ctm = IDENTITY.slice()

  const addImage = (name) => {
    const rect = unitSquareToNormRect(ctm, viewport)
    if (!isUsefulImage(rect)) return
    images.push({
      name: typeof name === 'string' ? name : '',
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      w: Math.min(1, rect.w),
      h: Math.min(1, rect.h),
    })
  }

  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]
    if (fn === OPS.save) {
      stack.push(ctm.slice())
    } else if (fn === OPS.restore) {
      ctm = stack.pop() || IDENTITY.slice()
    } else if (fn === OPS.transform) {
      ctm = Util.transform(ctm, args)
    } else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm.slice())
      if (args?.[0]) ctm = Util.transform(ctm, args[0])
    } else if (fn === OPS.paintFormXObjectEnd) {
      ctm = stack.pop() || IDENTITY.slice()
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      addImage(args?.[0])
    }
  }
  return images
}

export function paintImageHits(pageEl, images, activeKey = '') {
  if (!pageEl) return
  const host = pageEl.querySelector('.canvasWrapper') || pageEl
  let layer = host.querySelector(':scope > .pdf-img-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'pdf-img-layer'
    host.appendChild(layer)
  }
  layer.replaceChildren()
  for (const img of images || []) {
    const el = document.createElement('i')
    const key = `${img.name}|${img.x.toFixed(4)}|${img.y.toFixed(4)}`
    el.className = `pdf-img-hit${key === activeKey ? ' is-active' : ''}`
    el.style.left = `${img.x * 100}%`
    el.style.top = `${img.y * 100}%`
    el.style.width = `${img.w * 100}%`
    el.style.height = `${img.h * 100}%`
    el.dataset.imgKey = key
    layer.appendChild(el)
  }
}

export function hitPageImage(pageEl, images, clientX, clientY) {
  if (!pageEl || !images?.length) return null
  const box = (pageEl.querySelector('.canvasWrapper') || pageEl).getBoundingClientRect()
  if (box.width < 2 || box.height < 2) return null
  const nx = (clientX - box.left) / box.width
  const ny = (clientY - box.top) / box.height
  const hits = images.filter(
    (img) => nx >= img.x && nx <= img.x + img.w && ny >= img.y && ny <= img.y + img.h,
  )
  if (!hits.length) return null
  hits.sort((a, b) => a.w * a.h - b.w * b.h)
  return hits[0]
}

export function imageHitKey(img) {
  if (!img) return ''
  return `${img.name || ''}|${Number(img.x).toFixed(4)}|${Number(img.y).toFixed(4)}`
}

export function rectToClientBounds(pageEl, rect) {
  const box = (pageEl.querySelector('.canvasWrapper') || pageEl).getBoundingClientRect()
  return {
    left: box.left + rect.x * box.width,
    top: box.top + rect.y * box.height,
    right: box.left + (rect.x + rect.w) * box.width,
    bottom: box.top + (rect.y + rect.h) * box.height,
  }
}

function toRgba(img) {
  const w = img.width
  const h = img.height
  const data = img.data
  const out = new Uint8ClampedArray(w * h * 4)
  if (img.kind === ImageKind.RGBA_32BPP) {
    out.set(data)
    return out
  }
  if (img.kind === ImageKind.RGB_24BPP) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out[j] = data[i]
      out[j + 1] = data[i + 1]
      out[j + 2] = data[i + 2]
      out[j + 3] = 255
    }
    return out
  }
  return null
}

function imageObjToCanvas(img) {
  if (!img) return null
  const w = img.width || img.naturalWidth
  const h = img.height || img.naturalHeight
  if (!w || !h) return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  try {
    if (img.bitmap) {
      ctx.drawImage(img.bitmap, 0, 0)
      return canvas
    }
    if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
      ctx.drawImage(img, 0, 0)
      return canvas
    }
    if (img instanceof HTMLCanvasElement || img instanceof HTMLImageElement) {
      ctx.drawImage(img, 0, 0)
      return canvas
    }
    if (img.data && img.kind) {
      const rgba = toRgba(img)
      if (!rgba) return null
      ctx.putImageData(new ImageData(rgba, w, h), 0, 0)
      return canvas
    }
  } catch {
    return null
  }
  return null
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function cropPageRectToPng(pageEl, rect) {
  const canvas = pageEl?.querySelector('.canvasWrapper canvas')
  if (!canvas || !rect) return Promise.resolve(null)
  const sx = Math.max(0, Math.floor(rect.x * canvas.width))
  const sy = Math.max(0, Math.floor(rect.y * canvas.height))
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(rect.w * canvas.width)))
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(rect.h * canvas.height)))
  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  const ctx = out.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return canvasToPngBlob(out)
}

function readPageObj(page, name) {
  if (!name || !page) return null
  try {
    const local = page.objs.get(name)
    if (local) return local
  } catch {
    /* ignore */
  }
  try {
    return page.commonObjs.get(name) || null
  } catch {
    return null
  }
}

export async function copyPageImageBlob(page, pageEl, image) {
  if (image?.name && page) {
    const obj = readPageObj(page, image.name)
    const canvas = imageObjToCanvas(obj)
    if (canvas) {
      const blob = await canvasToPngBlob(canvas)
      if (blob) return blob
    }
  }
  return cropPageRectToPng(pageEl, image)
}

export async function writeClipboardPng(blob) {
  if (!blob) throw new Error('empty')
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('clipboard')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export async function writeClipboardText(text) {
  if (!text) throw new Error('empty')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ok = document.execCommand('copy')
  if (!ok) throw new Error('clipboard')
}
