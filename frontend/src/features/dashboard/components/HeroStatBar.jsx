const STAT_ITEMS = [
  { key: 'streak_current', label: 'Streak فعلی', suffix: 'روز', accent: 'brand' },
  { key: 'streak_longest', label: 'بیشینهٔ Streak', suffix: 'روز', accent: 'sky' },
  { key: 'active_days', label: 'روز فعال', suffix: 'روز', accent: 'ok' },
  { key: 'reading_count', label: 'در حال خواندن', suffix: 'کتاب', accent: 'brand' },
  { key: 'entries_count', label: 'یادداشت‌ها', suffix: 'مورد', accent: 'sky' },
  { key: 'challenges_active', label: 'چالش فعال', suffix: 'مورد', accent: 'ok' },
]

export default function HeroStatBar({ stats }) {
  return (
    <section className="dash-hero-stats" aria-label="وضعیت سریع">
      {STAT_ITEMS.map((item) => (
        <article key={item.key} className={`dash-stat dash-stat-${item.accent}`}>
          <span className="dash-stat-label">{item.label}</span>
          <strong className="dash-stat-value">{stats?.[item.key] ?? 0}</strong>
          <span className="dash-stat-suffix">{item.suffix}</span>
        </article>
      ))}
    </section>
  )
}
