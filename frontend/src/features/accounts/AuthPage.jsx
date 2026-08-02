import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import ToastHost from '../../shared/ToastHost'

export default function AuthPage({ mode: initialMode = 'login' }) {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState(initialMode)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.body.className = 'page-auth'
    return () => {
      document.body.className = ''
    }
  }, [])

  useEffect(() => {
    setMode(location.pathname.includes('signup') ? 'signup' : 'login')
  }, [location.pathname])

  const switchMode = (next) => {
    setError('')
    setMode(next)
    navigate(next === 'signup' ? '/signup' : '/login', { replace: true })
  }

  const onLogin = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.target)
    try {
      await login({ email: fd.get('email'), password: fd.get('password') })
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ورود ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  const onSignup = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.target)
    try {
      await signup({
        email: fd.get('email'),
        username: fd.get('username'),
        password: fd.get('password'),
        password_confirm: fd.get('password_confirm'),
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت‌نام ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-stage" id="auth-stage" data-mode={mode} dir="ltr">
      <div className="auth-accent">
        <div className={`auth-accent-panel auth-accent-login${mode === 'login' ? ' is-active' : ''}`}>
          <h2>سلام دوباره</h2>
          <p>به دفتر حس‌ها و ورق‌ها خوش آمدی.</p>
          <button type="button" className="auth-accent-btn" onClick={() => switchMode('signup')}>
            ثبت‌نام
          </button>
        </div>
        <div className={`auth-accent-panel auth-accent-signup${mode === 'signup' ? ' is-active' : ''}`}>
          <h2>تازه‌واردی؟</h2>
          <p>یک حساب بساز و قفسه‌ات را شروع کن.</p>
          <button type="button" className="auth-accent-btn" onClick={() => switchMode('login')}>
            ورود
          </button>
        </div>
      </div>

      <div className="auth-forms" dir="rtl">
        <div className="auth-forms-inner">
          <ToastHost />
          {error ? (
            <div className="auth-messages">
              <div className="toast toast-error">{error}</div>
            </div>
          ) : null}

          <form
            className="auth-form"
            data-auth-form="login"
            hidden={mode !== 'login'}
            onSubmit={onLogin}
          >
            <h1 className="auth-title">ورود</h1>
            <div className="field">
              <label htmlFor="login-email">ایمیل</label>
              <input id="login-email" name="email" type="email" className="auth-input" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="login-password">رمز عبور</label>
              <input id="login-password" name="password" type="password" className="auth-input" required autoComplete="current-password" />
            </div>
            <button type="submit" className="auth-submit auth-submit-login" disabled={busy}>
              ورود
            </button>
            <p className="auth-mobile-switch">
              حساب نداری؟{' '}
              <button type="button" onClick={() => switchMode('signup')}>
                ثبت‌نام
              </button>
            </p>
          </form>

          <form
            className="auth-form"
            data-auth-form="signup"
            hidden={mode !== 'signup'}
            onSubmit={onSignup}
          >
            <h1 className="auth-title">ثبت‌نام</h1>
            <div className="field">
              <label htmlFor="signup-email">ایمیل</label>
              <input id="signup-email" name="email" type="email" className="auth-input" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="signup-username">نام کاربری</label>
              <input id="signup-username" name="username" className="auth-input" required autoComplete="nickname" />
            </div>
            <div className="field">
              <label htmlFor="signup-password">رمز عبور</label>
              <input id="signup-password" name="password" type="password" className="auth-input" required autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="signup-password2">تکرار رمز</label>
              <input id="signup-password2" name="password_confirm" type="password" className="auth-input" required autoComplete="new-password" />
            </div>
            <button type="submit" className="auth-submit auth-submit-signup" disabled={busy}>
              ساخت حساب
            </button>
            <p className="auth-mobile-switch">
              قبلاً ثبت‌نام کردی؟{' '}
              <button type="button" onClick={() => switchMode('login')}>
                ورود
              </button>
            </p>
          </form>

          <p style={{ marginTop: '1rem', opacity: 0.7 }}>
            <Link to="/">بازگشت</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
