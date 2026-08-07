import i18n from 'i18next'
import { DEFAULT_LOCALE, LOCALE_META, normalizeLocale, readStoredLocale, writeStoredLocale } from './config'

export function getIntlLocale(lng = i18n.language) {
  const locale = normalizeLocale(lng)
  return LOCALE_META[locale].intl
}

export function formatDate(value, options = {}, lng = i18n.language) {
  if (value == null || value === '') return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(getIntlLocale(lng), options).format(date)
}

export function formatNumber(value, options = {}, lng = i18n.language) {
  if (value == null || Number.isNaN(Number(value))) return ''
  return new Intl.NumberFormat(getIntlLocale(lng), options).format(Number(value))
}
