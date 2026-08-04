import { Link } from 'react-router-dom'

const ACTIONS = [
  {
    to: '/vocabulary',
    title: 'فلش‌کارت‌ها',
    subtitle: 'مرور واژه‌ها',
    countKey: 'vocabulary_count',
    countLabel: 'واژه',
    tone: 'sky',
  },
  {
    to: '/challenges',
    title: 'چالش‌ها',
    subtitle: 'هدف‌های مطالعه',
    countKey: 'challenges_active',
    countLabel: 'فعال',
    tone: 'brand',
  },
  {
    to: '/books?status=reading',
    title: 'در حال خواندن',
    subtitle: 'ادامه از قفسه',
    countKey: 'reading_count',
    countLabel: 'کتاب',
    tone: 'ok',
  },
]

export default function QuickActions({ quick }) {
  return (
    <section className="dash-quick section" aria-label="دسترسی سریع">
      <div className="section-head">
        <h2>دسترسی سریع</h2>
        <p>میان‌بر به بخش‌هایی که بیشتر به کار می‌آیند.</p>
      </div>
      <div className="dash-quick-grid">
        {ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className={`dash-quick-card tone-${action.tone}`}>
            <div className="dash-quick-copy">
              <strong>{action.title}</strong>
              <span>{action.subtitle}</span>
            </div>
            <div className="dash-quick-count">
              <b>{quick?.[action.countKey] ?? 0}</b>
              <small>{action.countLabel}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
