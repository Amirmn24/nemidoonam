import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const STAT_DEFS = [
  { key: 'streak_current', i18nKey: 'streakCurrent', accent: 'brand' },
  { key: 'streak_longest', i18nKey: 'streakLongest', accent: 'sky' },
  { key: 'active_days', i18nKey: 'activeDays', accent: 'ok' },
  { key: 'reading_count', i18nKey: 'readingCount', accent: 'brand' },
  { key: 'entries_count', i18nKey: 'entriesCount', accent: 'sky' },
  { key: 'challenges_active', i18nKey: 'challengesActive', accent: 'ok' },
]

export default function HeroStatBar({ stats }) {
  const { t } = useTranslation()

  const items = useMemo(
    () =>
      STAT_DEFS.map((item) => ({
        ...item,
        label: t(`dashboard.stats.${item.i18nKey}.label`),
        short: t(`dashboard.stats.${item.i18nKey}.short`),
        suffix: t(`dashboard.stats.${item.i18nKey}.suffix`),
      })),
    [t],
  )

  return (
    <section className="dash-hero-stats" aria-label={t('dashboard.stats.aria')}>
      {items.map((item) => (
        <article key={item.key} className={`dash-stat dash-stat-${item.accent}`}>
          <span className="dash-stat-label">
            <span className="dash-stat-label-full">{item.label}</span>
            <span className="dash-stat-label-short">{item.short}</span>
          </span>
          <strong className="dash-stat-value">{stats?.[item.key] ?? 0}</strong>
          <span className="dash-stat-suffix">{item.suffix}</span>
        </article>
      ))}
    </section>
  )
}
