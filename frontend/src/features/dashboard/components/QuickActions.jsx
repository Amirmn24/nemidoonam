import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const ACTION_DEFS = [
  {
    to: '/vocabulary',
    i18nKey: 'vocabulary',
    countKey: 'vocabulary_count',
    tone: 'sky',
  },
  {
    to: '/challenges',
    i18nKey: 'challenges',
    countKey: 'challenges_active',
    tone: 'brand',
  },
  {
    to: '/books?status=reading',
    i18nKey: 'reading',
    countKey: 'reading_count',
    tone: 'ok',
  },
]

export default function QuickActions({ quick }) {
  const { t } = useTranslation()

  const actions = useMemo(
    () =>
      ACTION_DEFS.map((action) => ({
        ...action,
        title: t(`dashboard.quick.${action.i18nKey}.title`),
        subtitle: t(`dashboard.quick.${action.i18nKey}.subtitle`),
        countLabel: t(`dashboard.quick.${action.i18nKey}.countLabel`),
      })),
    [t],
  )

  return (
    <section className="dash-quick section" aria-label={t('dashboard.quick.aria')}>
      <div className="section-head">
        <h2>{t('dashboard.quick.title')}</h2>
        <p>{t('dashboard.quick.subtitle')}</p>
      </div>
      <div className="dash-quick-grid">
        {actions.map((action) => (
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
