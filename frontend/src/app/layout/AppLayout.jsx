import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/AuthContext'
import ToastHost from '../../shared/ToastHost'

const STORAGE_KEY = 'nemidoonam.sidebarCollapsed'

function navClass({ isActive }) {
  return `sidebar-link${isActive ? ' is-active' : ''}`
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return true
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const header = document.querySelector('[data-site-header]')
    if (!header) return undefined
    const sync = () => {
      document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bodyClass = [
    'has-sidebar',
    collapsed ? 'sidebar-collapsed' : '',
    mobileOpen ? 'sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    document.body.className = bodyClass
    return () => {
      document.body.className = ''
    }
  }, [bodyClass])

  const initial = (user?.display_label || '?').slice(0, 1)

  return (
    <>
      <div className="page-glow" aria-hidden="true" />
      <header className="site-header" data-site-header>
        <div className="container header-inner">
          <div className="header-start">
            <Link className="brand" to="/">
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-text">
                <strong>نمی‌دونم</strong>
                <small>دفتر حس‌ها و ورق‌ها</small>
              </span>
            </Link>
          </div>
          <div className="header-end">
            <Link to="/books/new" className="btn btn-primary header-cta">
              کتاب جدید
            </Link>
            <Link to="/profile" className="header-user" title={`پروفایل ${user?.username}`}>
              <div className="user-avatar" aria-hidden="true">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" />
                ) : (
                  <span className="user-avatar-fallback">{initial}</span>
                )}
              </div>
              <span className="user-name">{user?.display_label}</span>
            </Link>
          </div>
        </div>
      </header>

      <aside className="site-sidebar" id="site-sidebar" data-sidebar aria-label="منوی اصلی">
        <div className="sidebar-sheet">
          <div className="sidebar-handle" aria-hidden="true" />
          <div className="sidebar-head">
            <div className="sidebar-head-copy">
              <span className="sidebar-kicker">نمی‌دونم</span>
              <strong className="sidebar-title">منوی اصلی</strong>
            </div>
            <button
              type="button"
              className="sidebar-collapse"
              aria-label="جمع‌کردن سایدبار"
              onClick={() => setCollapsed((v) => !v)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <button type="button" className="sidebar-close" aria-label="بستن منو" onClick={() => setMobileOpen(false)}>
              ×
            </button>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">📚</span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">کتاب‌ها</span>
                <span className="sidebar-label-sub">قفسه شخصی</span>
              </span>
            </NavLink>
            <NavLink to="/challenges" className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">🎯</span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">چالش‌ها</span>
                <span className="sidebar-label-sub">هدف‌های مطالعه</span>
              </span>
            </NavLink>
            <NavLink to="/vocabulary" className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">🃏</span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">واژه‌نامه</span>
                <span className="sidebar-label-sub">فلش‌کارت واژه</span>
              </span>
            </NavLink>
            <NavLink to="/profile" className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">👤</span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">پروفایل</span>
                <span className="sidebar-label-sub">اطلاعات حساب</span>
              </span>
            </NavLink>
          </nav>
          <div className="sidebar-foot">
            <button type="button" className="sidebar-link" onClick={() => logout()}>
              <span className="sidebar-icon" aria-hidden="true">⎋</span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">خروج</span>
                <span className="sidebar-label-sub">پایان نشست</span>
              </span>
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen ? (
        <div
          className="sidebar-backdrop"
          data-sidebar-backdrop
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="app-frame">
        <ToastHost />
        <div className="container main-content">
          <Outlet />
        </div>
        <footer className="site-footer">
          <div className="container">
            <span className="footer-brand">نمی‌دونم</span>
            <span className="footer-note">دفترخانه شخصی کتاب</span>
          </div>
        </footer>
      </div>

      <nav className="mobile-dock" aria-label="منوی موبایل">
        <Link to="/" className="mobile-dock-item">کتاب‌ها</Link>
        <Link to="/challenges" className="mobile-dock-item">چالش‌ها</Link>
        <Link to="/vocabulary" className="mobile-dock-item">واژه</Link>
        <button type="button" className="mobile-dock-item" onClick={() => setMobileOpen(true)}>
          منو
        </button>
        <Link to="/profile" className="mobile-dock-item">پروفایل</Link>
      </nav>
    </>
  )
}
