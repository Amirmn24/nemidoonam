import { useEffect } from 'react'
import { useAuth } from './AuthContext'

export default function ToastHost() {
  const { toast, clearToast } = useAuth()

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(clearToast, 3200)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  if (!toast) return null

  const tag = toast.type === 'error' ? 'error' : toast.type === 'success' ? 'success' : 'info'
  return (
    <div className="container messages" role="status">
      <div className={`toast toast-${tag}`}>{toast.message}</div>
    </div>
  )
}
