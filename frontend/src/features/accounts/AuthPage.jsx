import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { vMarkIndigo, vyrvonaIndigo } from '../../assets/brand'
import { ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import LocaleToggle from '../../shared/LocaleToggle'
import ThemeToggle from '../../shared/ThemeToggle'
import ToastHost from '../../shared/ToastHost'

export default function AuthPage({ mode: initialMode = 'login' }) {
  const { t, i18n } = useTranslation()
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState(initialMode)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const formsDir = i18n.language === 'en' ? 'ltr' : 'rtl'

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
      setError(err instanceof ApiError ? err.message : t('auth.loginFailed'))
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
      setError(err instanceof ApiError ? err.message : t('auth.signupFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-stage" id="auth-stage" data-mode={mode} dir="ltr">
      <div className="auth-theme-slot">
        <LocaleToggle />
        <ThemeToggle />
      </div>
      <div className="auth-accent">
        <div className={`auth-accent-panel auth-accent-login${mode === 'login' ? ' is-active' : ''}`}>
          <h2>{t('auth.helloAgain')}</h2>
          <p>{t('auth.welcomeBack')}</p>
          <button type="button" className="auth-accent-btn" onClick={() => switchMode('signup')}>
            {t('auth.signup')}
          </button>
        </div>
        <div className={`auth-accent-panel auth-accent-signup${mode === 'signup' ? ' is-active' : ''}`}>
          <h2>{t('auth.newHere')}</h2>
          <p>{t('auth.createAndStart')}</p>
          <button type="button" className="auth-accent-btn" onClick={() => switchMode('login')}>
            {t('auth.login')}
          </button>
        </div>
      </div>

      <div className="auth-forms" dir={formsDir}>
        <div className="auth-forms-inner">
          <div className="auth-brand">
            <img className="auth-brand-mark" src={vMarkIndigo} alt="" aria-hidden="true" />
            <img className="auth-brand-logo" src={vyrvonaIndigo} alt="Vyrvona" />
          </div>
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
            <h1 className="auth-title">{t('auth.login')}</h1>
            <div className="field">
              <label htmlFor="login-email">{t('auth.email')}</label>
              <input id="login-email" name="email" type="email" className="auth-input" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="login-password">{t('auth.password')}</label>
              <input id="login-password" name="password" type="password" className="auth-input" required autoComplete="current-password" />
            </div>
            <button type="submit" className="auth-submit auth-submit-login" disabled={busy}>
              {t('auth.login')}
            </button>
            <p className="auth-mobile-switch">
              {t('auth.noAccount')}{' '}
              <button type="button" onClick={() => switchMode('signup')}>
                {t('auth.signup')}
              </button>
            </p>
          </form>

          <form
            className="auth-form"
            data-auth-form="signup"
            hidden={mode !== 'signup'}
            onSubmit={onSignup}
          >
            <h1 className="auth-title">{t('auth.signup')}</h1>
            <div className="field">
              <label htmlFor="signup-email">{t('auth.email')}</label>
              <input id="signup-email" name="email" type="email" className="auth-input" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="signup-username">{t('auth.username')}</label>
              <input id="signup-username" name="username" className="auth-input" required autoComplete="nickname" />
            </div>
            <div className="field">
              <label htmlFor="signup-password">{t('auth.password')}</label>
              <input id="signup-password" name="password" type="password" className="auth-input" required autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="signup-password2">{t('auth.passwordConfirm')}</label>
              <input id="signup-password2" name="password_confirm" type="password" className="auth-input" required autoComplete="new-password" />
            </div>
            <button type="submit" className="auth-submit auth-submit-signup" disabled={busy}>
              {t('auth.createAccount')}
            </button>
            <p className="auth-mobile-switch">
              {t('auth.alreadySignedUp')}{' '}
              <button type="button" onClick={() => switchMode('login')}>
                {t('auth.login')}
              </button>
            </p>
          </form>

          <p className="auth-back-wrap">
            <Link className="auth-back-link" to="/">{t('app.back')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
