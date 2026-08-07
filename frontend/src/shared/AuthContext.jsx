import { useCallback, useContext, useEffect, useMemo, useState, createContext } from 'react'
import { useTranslation } from 'react-i18next'
import { authApi, ensureCsrf, resetCsrf } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type })
  }, [])

  const refresh = useCallback(async () => {
    await ensureCsrf()
    const data = await authApi.me()
    setUser(data.authenticated ? data.user : null)
    return data
  }, [])

  useEffect(() => {
    refresh()
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [refresh])

  const login = useCallback(async (payload) => {
    const data = await authApi.login(payload)
    setUser(data.user)
    showToast(t('auth.welcomeToast'))
    return data
  }, [showToast, t])

  const signup = useCallback(async (payload) => {
    const data = await authApi.signup(payload)
    setUser(data.user)
    showToast(t('auth.signupToast'))
    return data
  }, [showToast, t])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* clear local session even if API fails */
    } finally {
      resetCsrf()
      setUser(null)
      showToast(t('auth.logoutToast'))
    }
  }, [showToast, t])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      refresh,
      setUser,
      toast,
      showToast,
      clearToast: () => setToast(null),
    }),
    [user, loading, login, signup, logout, refresh, toast, showToast],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
