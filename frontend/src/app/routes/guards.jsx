import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="container main-content" style={{ paddingTop: '4rem' }}>
        <p>در حال بارگذاری…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="container main-content" style={{ paddingTop: '4rem' }}>
        <p>در حال بارگذاری…</p>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
