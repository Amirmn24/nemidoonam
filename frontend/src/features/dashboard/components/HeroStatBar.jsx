const STAT_ITEMS = [
  { key: 'streak_current', label: 'Streak فعلی', short: 'Streak', suffix: 'روز', accent: 'brand' },
  { key: 'streak_longest', label: 'بیشینهٔ Streak', short: 'رکورد', suffix: 'روز', accent: 'sky' },
  { key: 'active_days', label: 'روز فعال', short: 'فعال', suffix: 'روز', accent: 'ok' },
  { key: 'reading_count', label: 'در حال خواندن', short: 'خواندن', suffix: 'کتاب', accent: 'brand' },
  { key: 'entries_count', label: 'یادداشت‌ها', short: 'یادداشت', suffix: 'مورد', accent: 'sky' },
  { key: 'challenges_active', label: 'چالش فعال', short: 'چالش', suffix: 'مورد', accent: 'ok' },
]

export default function HeroStatBar({ stats }) {
  return (
    <section className="dash-hero-stats" aria-label="وضعیت سریع">
      {STAT_ITEMS.map((item) => (
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
