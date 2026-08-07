import i18n from 'i18next'

/**
 * Translate an API enum/code under a prefix, falling back to a server display string.
 * Example: labelFromCode('books.status', 'reading', book.status_display)
 */
export function labelFromCode(prefix, code, fallback = '') {
  if (!code) return fallback || ''
  const key = `${prefix}.${code}`
  if (i18n.exists(key)) return i18n.t(key)
  return fallback || String(code)
}
