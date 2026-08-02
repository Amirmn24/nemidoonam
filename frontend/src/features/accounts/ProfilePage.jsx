import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'

export default function ProfilePage() {
  const { user, setUser, showToast } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(user?.avatar_url || null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = e.target
    const fd = new FormData(form)
    if (!form.clear_avatar?.checked) fd.delete('clear_avatar')
    else fd.set('clear_avatar', 'true')
    if (!fd.get('avatar')?.size) fd.delete('avatar')
    try {
      const updated = await authApi.updateProfile(fd)
      setUser(updated)
      setPreview(updated.avatar_url)
      showToast('پروفایل ذخیره شد.', 'success')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-profile">
      <section className="profile-hero">
        <div className="profile-hero-avatar">
          {preview ? <img src={preview} alt="" /> : <span>{(user?.display_label || '?')[0]}</span>}
        </div>
        <div className="profile-hero-copy">
          <p className="eyebrow">حساب کاربری</p>
          <h1>{user?.display_label}</h1>
          <p className="profile-username">@{user?.username}</p>
        </div>
      </section>

      <section className="section form-page">
        <div className="page-toolbar section-head">
          <h2>ویرایش پروفایل</h2>
        </div>
        <div className="profile-readonly">
          <strong>ایمیل ورود:</strong> {user?.email}
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        <form className="form-panel profile-form" onSubmit={onSubmit}>
          <div className="form-step">
            <div className="form-step-label">
              <span className="form-step-num">۱</span> هویت
            </div>
            <div className="form-grid form-grid-3">
              <div className="field">
                <label>نام کاربری</label>
                <input name="username" className="field-input" defaultValue={user?.username} required />
              </div>
              <div className="field">
                <label>نام</label>
                <input name="first_name" className="field-input" defaultValue={user?.first_name || ''} />
              </div>
              <div className="field">
                <label>نام خانوادگی</label>
                <input name="last_name" className="field-input" defaultValue={user?.last_name || ''} />
              </div>
            </div>
          </div>
          <div className="form-step">
            <div className="form-step-label">
              <span className="form-step-num">۲</span> ارتباط
            </div>
            <div className="field">
              <label>آیدی تلگرام</label>
              <input name="telegram_id" className="field-input" defaultValue={user?.telegram_id || ''} />
            </div>
          </div>
          <div className="form-step">
            <div className="form-step-label">
              <span className="form-step-num">۳</span> آواتار
            </div>
            <div className="profile-avatar-field">
              <div className="profile-avatar-preview">
                {preview ? <img src={preview} alt="" /> : <span>{(user?.display_label || '?')[0]}</span>}
              </div>
              <input
                name="avatar"
                type="file"
                accept="image/*"
                className="field-file"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  setPreview(file ? URL.createObjectURL(file) : user?.avatar_url)
                }}
              />
              {user?.avatar_url ? (
                <label className="profile-clear-avatar">
                  <input type="checkbox" name="clear_avatar" /> حذف عکس فعلی
                </label>
              ) : null}
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              ذخیره
            </button>
            <Link to="/" className="btn btn-ghost">
              بازگشت
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
