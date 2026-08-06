import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/AuthContext'
import ThemeToggle from '../../shared/ThemeToggle'
import ToastHost from '../../shared/ToastHost'

const STORAGE_KEY = 'vyrvona.sidebarCollapsed'

function navClass({ isActive }) {
  return `sidebar-link${isActive ? ' is-active' : ''}`
}

function dockClass(isActive) {
  return `mobile-dock-item${isActive ? ' is-active' : ''}`
}

const IconHome = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10.5L12 4l8 6.5" />
    <path d="M7 10v9h10v-9" />
  </svg>
)

const IconBook = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
    <path d="M4 5.5V21.5" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
  </svg>
)

const IconStar = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18l.9-5.4L4.2 8.7l5.4-.8z" />
  </svg>
)

const IconCards = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4h10v16H7z" />
    <path d="M10 8h4" />
    <path d="M9 12h6" />
    <path d="M10 16h4" />
  </svg>
)

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5.5 19.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5" />
  </svg>
)

const IconLogout = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    <path d="M16 12H9" />
    <path d="M14 8l4 4-4 4" />
  </svg>
)

const IconMenu = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M5 7h14M5 12h14M5 17h10" />
  </svg>
)

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return true
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

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
  const path = location.pathname

  return (
    <>
      <div className="page-glow" aria-hidden="true" />
      <header className="site-header" data-site-header>
        <div className="container header-inner">
          <div className="header-start">
            <Link className="brand" to="/">
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-text">
                <strong>ویرونا</strong>
                <small>Vyrvona</small>
              </span>
            </Link>
          </div>
          <div className="header-end">
            <ThemeToggle />
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
              <span className="sidebar-kicker">ویرونا</span>
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
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">
                <IconHome />
              </span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">داشبورد</span>
                <span className="sidebar-label-sub">نبض فعالیت</span>
              </span>
            </NavLink>
            <NavLink to="/books" className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">
                <IconBook />
              </span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">کتاب‌ها</span>
                <span className="sidebar-label-sub">قفسه شخصی</span>
              </span>
            </NavLink>
            <NavLink to="/challenges" className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">
                <IconStar />
              </span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">چالش‌ها</span>
                <span className="sidebar-label-sub">هدف‌های مطالعه</span>
              </span>
            </NavLink>
            <NavLink to="/vocabulary" className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">
                <IconCards />
              </span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">واژه‌نامه</span>
                <span className="sidebar-label-sub">فلش‌کارت واژه</span>
              </span>
            </NavLink>
            <NavLink to="/profile" className={navClass}>
              <span className="sidebar-icon" aria-hidden="true">
                <IconUser />
              </span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">پروفایل</span>
                <span className="sidebar-label-sub">اطلاعات حساب</span>
              </span>
            </NavLink>
          </nav>
          <div className="sidebar-foot">
            <button
              type="button"
              className="sidebar-link sidebar-logout"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-busy={loggingOut}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <IconLogout />
              </span>
              <span className="sidebar-label">
                <span className="sidebar-label-title">{loggingOut ? 'در حال خروج…' : 'خروج'}</span>
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
          <div className="container footer-inner">
            <p className="footer-brand">ویرونا</p>
            <p className="footer-note">Vyrvona · جایی برای حس‌ها، دیدگاه‌ها و ورق‌های کتاب</p>
          </div>
        </footer>
      </div>

      <nav className="mobile-dock" aria-label="ناوبری سریع">
        <Link to="/" className={dockClass(path === '/')}>
          <IconHome />
          <span>خانه</span>
        </Link>
        <Link to="/books" className={dockClass(path.startsWith('/books'))}>
          <IconBook />
          <span>کتاب‌ها</span>
        </Link>
        <Link to="/challenges" className={dockClass(path.startsWith('/challenges'))}>
          <IconStar />
          <span>چالش‌ها</span>
        </Link>
        <button
          type="button"
          className="mobile-dock-item"
          onClick={() => setMobileOpen(true)}
          aria-controls="site-sidebar"
          aria-expanded={mobileOpen}
          aria-label="باز کردن منو"
        >
          <IconMenu />
          <span>منو</span>
        </button>
        <Link to="/profile" className={dockClass(path.startsWith('/profile'))}>
          <IconUser />
          <span>پروفایل</span>
        </Link>
      </nav>
    </>
  )
}
