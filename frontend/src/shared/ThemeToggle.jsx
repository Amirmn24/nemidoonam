import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13.5A7.5 7.5 0 1 1 10.5 4 6 6 0 0 0 20 13.5z" />
    </svg>
  )
}

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const label = isDark ? t('theme.light') : t('theme.dark')

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </button>
  )
}
