import { useCallback, useEffect, useState } from 'react'
import { booksApi } from '../../../shared/api'

/**
 * هایلایت‌های سند قفسه — فقط متادیتا؛ فایل PDF بازنویسی نمی‌شود.
 */
export function useDocumentHighlights(shelfId) {
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(Boolean(shelfId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shelfId) {
      setHighlights([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    booksApi
      .listHighlights(shelfId)
      .then((data) => {
        if (!cancelled) setHighlights(data.results || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shelfId])

  const createHighlight = useCallback(
    async (payload) => {
      const created = await booksApi.createHighlight(shelfId, payload)
      setHighlights((prev) =>
        [...prev, created].sort((a, b) => a.page_number - b.page_number || a.id - b.id),
      )
      return created
    },
    [shelfId],
  )

  const updateHighlight = useCallback(
    async (highlightId, body) => {
      const updated = await booksApi.updateHighlight(shelfId, highlightId, body)
      setHighlights((prev) => prev.map((h) => (h.id === highlightId ? updated : h)))
      return updated
    },
    [shelfId],
  )

  const updateHighlightColor = useCallback(
    (highlightId, color) => updateHighlight(highlightId, { color }),
    [updateHighlight],
  )

  const updateHighlightNote = useCallback(
    (highlightId, note) => updateHighlight(highlightId, { note }),
    [updateHighlight],
  )

  const removeHighlight = useCallback(
    async (highlightId) => {
      await booksApi.deleteHighlight(shelfId, highlightId)
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId))
    },
    [shelfId],
  )

  return {
    highlights,
    loading,
    error,
    createHighlight,
    updateHighlight,
    updateHighlightColor,
    updateHighlightNote,
    removeHighlight,
  }
}
