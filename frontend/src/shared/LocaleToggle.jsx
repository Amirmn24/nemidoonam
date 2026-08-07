import { useTranslation } from 'react-i18next'
import { changeAppLanguage } from '../i18n'
import { LOCALE_META, SUPPORTED_LOCALES, normalizeLocale } from '../i18n/config'

export default function LocaleToggle({ className = '' }) {
  const { t, i18n } = useTranslation()
  const current = normalizeLocale(i18n.language)

  async function handleSelect(next) {
    if (next === current) return
    await changeAppLanguage(next)
  }

  return (
    <div className={`locale-toggle ${className}`.trim()} role="group" aria-label={t('locale.group')}>
      {SUPPORTED_LOCALES.map((code) => {
        const meta = LOCALE_META[code]
        const active = code === current
        return (
          <button
            key={code}
            type="button"
            className={`locale-toggle-btn${active ? ' is-active' : ''}`}
            onClick={() => handleSelect(code)}
            aria-pressed={active}
            aria-label={t('locale.switchTo', { label: meta.label })}
            title={t('locale.switchTo', { label: meta.label })}
          >
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}
