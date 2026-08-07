import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  normalizeLocale,
  readStoredLocale,
  writeStoredLocale,
} from './config'
import en from './locales/en.json'
import fa from './locales/fa.json'

export function applyDocumentLocale(lng) {
  const locale = normalizeLocale(lng)
  const meta = LOCALE_META[locale]
  const root = document.documentElement
  root.lang = meta.htmlLang
  root.dir = meta.dir
  document.title = i18n.t('app.title')
}

async function changeAppLanguage(lng) {
  const locale = normalizeLocale(lng)
  writeStoredLocale(locale)
  await i18n.changeLanguage(locale)
  applyDocumentLocale(locale)
  return locale
}

const initialLocale = typeof window !== 'undefined' ? readStoredLocale() : DEFAULT_LOCALE

void i18n.use(initReactI18next).init({
  resources: {
    fa: { translation: fa },
    en: { translation: en },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: ['fa', 'en'],
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocumentLocale(initialLocale)

i18n.on('languageChanged', (lng) => {
  applyDocumentLocale(lng)
})

export { changeAppLanguage, i18n }
export default i18n
