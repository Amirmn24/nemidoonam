import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/AuthContext'
import { dashboardApi } from '../../shared/api'
import ActivityHeatmap from './components/ActivityHeatmap'
import HeroStatBar from './components/HeroStatBar'
import QuickActions from './components/QuickActions'
import VibeRadar from './components/VibeRadar'

export default function DashboardPage() {
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
        if (!cancelled) setError(err.message || 'بارگذاری داشبورد ناموفق بود.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="dash-loading">در حال آماده‌سازی داشبورد…</p>
  if (error) return <p className="form-errors">{error}</p>
  if (!data) return null

  const name = user?.display_label || user?.username || 'خواننده'

  return (
    <div className="page-dashboard">
      <section className="dash-intro">
        <div className="dash-intro-copy">
          <p className="eyebrow">داشبورد</p>
          <h1>سلام، {name}</h1>
          <p>این‌جا نبض مطالعه‌ات است — streak، فعالیت روزانه و میان‌برهای سریع.</p>
        </div>
        <Link to="/books" className="btn btn-secondary">
          برو به قفسه
        </Link>
      </section>

      <HeroStatBar stats={data.stats} />

      <ActivityHeatmap heatmap={data.heatmap} stats={data.stats} />

      <VibeRadar vibe={data.vibe} />

      <QuickActions quick={data.quick} />
    </div>
  )
}
