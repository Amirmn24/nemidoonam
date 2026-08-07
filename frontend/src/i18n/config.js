export const STORAGE_KEY = 'vyrvona.locale'
export const DEFAULT_LOCALE = 'fa'
export const SUPPORTED_LOCALES = ['fa', 'en']

export const LOCALE_META = {
  fa: { dir: 'rtl', htmlLang: 'fa', intl: 'fa-IR', label: 'FA' },
  en: { dir: 'ltr', htmlLang: 'en', intl: 'en-US', label: 'EN' },
}

export function normalizeLocale(value) {
  if (SUPPORTED_LOCALES.includes(value)) return value
  return DEFAULT_LOCALE
}

export function readStoredLocale() {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_LOCALE
  }
}

export function writeStoredLocale(locale) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeLocale(locale))
  } catch {
    /* ignore */
  }
}
