import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { booksApi, challengesApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'

export default function ChallengeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { showToast } = useAuth()
  const [shelf, setShelf] = useState([])
  const [challenge, setChallenge] = useState(null)
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const load = async () => {
      try {
        const shelfData = await booksApi.list()
        setShelf(shelfData.results || [])
        if (isEdit) {
          const data = await challengesApi.detail(id)
          setChallenge(data)
          setSelected(data.books.map((b) => b.shelf_id).filter(Boolean))
        }
      } catch (err) {
        setError(err.message || 'خطا')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit])

  const toggle = (shelfId) => {
    setSelected((prev) =>
      prev.includes(shelfId) ? prev.filter((x) => x !== shelfId) : [...prev, shelfId],
    )
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.target)
    const body = {
      title: fd.get('title'),
      description: fd.get('description') || '',
      period_unit: fd.get('period_unit'),
      duration: Number(fd.get('duration')),
      starts_on: fd.get('starts_on'),
      shelf_ids: selected,
    }
    try {
      const saved = isEdit
        ? await challengesApi.update(id, body)
        : await challengesApi.create(body)
      showToast(isEdit ? 'چالش به‌روز شد.' : 'چالش ساخته شد.', 'success')
      navigate(`/challenges/${saved.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>در حال بارگذاری…</p>

  return (
    <div className="page-challenge-form">
      <section className="section form-page">
        <div className="page-toolbar">
          <h1>{isEdit ? 'ویرایش چالش' : 'چالش جدید'}</h1>
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        <form className="form-panel" onSubmit={onSubmit}>
          <div className="field">
            <label>عنوان</label>
            <input name="title" className="field-input" defaultValue={challenge?.title || ''} required />
          </div>
          <div className="field">
            <label>توضیح</label>
            <textarea
              name="description"
              className="field-textarea"
              rows={3}
              defaultValue={challenge?.description || ''}
            />
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>واحد زمان</label>
              <select name="period_unit" className="field-select" defaultValue={challenge?.period_unit || 'week'}>
                <option value="day">روز</option>
                <option value="week">هفته</option>
                <option value="month">ماه</option>
              </select>
            </div>
            <div className="field">
              <label>مدت</label>
              <input
                name="duration"
                type="number"
                min="1"
                className="field-input"
                defaultValue={challenge?.duration || 1}
                required
              />
            </div>
            <div className="field">
              <label>شروع</label>
              <input
                name="starts_on"
                type="date"
                className="field-input"
                defaultValue={challenge?.starts_on || today}
                required
              />
            </div>
          </div>

          <div className="form-step">
            <div className="form-step-label">کتاب‌های قفسه</div>
            {shelf.length === 0 ? (
              <div className="empty-state compact">
                <p>اول کتابی به قفسه اضافه کن.</p>
                <Link to="/books/new" className="btn btn-secondary">
                  افزودن کتاب
                </Link>
              </div>
            ) : (
              <div className="book-pick-list">
                {shelf.map((b) => (
                  <label key={b.id} className="book-pick-item">
                    <input
                      type="checkbox"
                      checked={selected.includes(b.id)}
                      onChange={() => toggle(b.id)}
                    />
                    <span>
                      {b.title} — {b.author}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || selected.length === 0}
            >
              ذخیره
            </button>
            <Link to={isEdit ? `/challenges/${id}` : '/challenges'} className="btn btn-ghost">
              انصراف
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
