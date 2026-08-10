import { useEffect, useState } from 'react'
import { booksApi, ApiError } from '../../../shared/api'

/**
 * PDF را فقط از API احراز هویت‌شده می‌گیرد و به Object URL تبدیل می‌کند.
 * کلید استوریج / URL عمومی هرگز به pdf.js داده نمی‌شود.
 * روی unmount URL revoke می‌شود تا بایت‌ها در حافظه نمانند.
 *
 * @param {string|number|null|undefined} shelfId
 */
export function useSecurePdfSource(shelfId) {
  const [sourceUrl, setSourceUrl] = useState(null)
  const [loading, setLoading] = useState(Boolean(shelfId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shelfId) {
      setSourceUrl(null)
      setLoading(false)
      setError('')
      return undefined
    }

    let cancelled = false
    let objectUrl = null

    const load = async () => {
      setLoading(true)
      setError('')
      setSourceUrl(null)
      try {
        const blob = await booksApi.fetchDocumentBlob(shelfId)
        if (cancelled) return
        if (!blob || blob.size === 0) {
          throw new ApiError('فایل PDF خالی است.', { status: 204 })
        }
        objectUrl = URL.createObjectURL(blob)
        setSourceUrl(objectUrl)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : String(err?.message || err))
        setSourceUrl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [shelfId])

  return { sourceUrl, loading, error }
}
