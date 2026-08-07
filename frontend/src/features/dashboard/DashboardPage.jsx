import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../shared/AuthContext'
import { dashboardApi } from '../../shared/api'
import ActivityHeatmap from './components/ActivityHeatmap'
import HeroStatBar from './components/HeroStatBar'
import QuickActions from './components/QuickActions'
import VibeRadar from './components/VibeRadar'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    dashboardApi
      .summary()
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || t('dashboard.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  if (loading) return <p className="dash-loading">{t('dashboard.loading')}</p>
  if (error) return <p className="form-errors">{error}</p>
  if (!data) return null

  const name = user?.display_label || user?.username || t('dashboard.readerFallback')

  return (
    <div className="page-dashboard">
      <section className="dash-intro">
        <div className="dash-intro-copy">
          <p className="eyebrow">{t('dashboard.eyebrow')}</p>
          <h1>{t('dashboard.greeting', { name })}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <Link to="/books" className="btn btn-secondary dash-intro-cta">
          {t('dashboard.goToShelf')}
        </Link>
      </section>

      <HeroStatBar stats={data.stats} />

      <QuickActions quick={data.quick} />

      <ActivityHeatmap heatmap={data.heatmap} stats={data.stats} />

      <VibeRadar vibe={data.vibe} />
    </div>
  )
}
