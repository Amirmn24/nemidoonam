import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi, challengesApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import { labelFromCode } from '../../i18n/labels'

export default function ChallengeFormPage() {
  const { t } = useTranslation()
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
        setError(err.message || t('app.error'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit, t])

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
      showToast(
        isEdit ? t('challenges.form.updatedToast') : t('challenges.form.createdToast'),
        'success',
      )
      navigate(`/challenges/${saved.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>{t('app.loading')}</p>

  return (
    <div className="page-challenge-form">
      <section className="section form-page">
        <div className="page-toolbar">
          <h1>{isEdit ? t('challenges.form.editTitle') : t('challenges.form.newTitle')}</h1>
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        <form className="form-panel" onSubmit={onSubmit}>
          <div className="field">
            <label>{t('challenges.form.title')}</label>
            <input name="title" className="field-input" defaultValue={challenge?.title || ''} required />
          </div>
          <div className="field">
            <label>{t('challenges.form.description')}</label>
            <textarea
              name="description"
              className="field-textarea"
              rows={3}
              defaultValue={challenge?.description || ''}
            />
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>{t('challenges.form.periodUnit')}</label>
              <select name="period_unit" className="field-select" defaultValue={challenge?.period_unit || 'week'}>
                <option value="day">{labelFromCode('challenges.periodUnit', 'day')}</option>
                <option value="week">{labelFromCode('challenges.periodUnit', 'week')}</option>
                <option value="month">{labelFromCode('challenges.periodUnit', 'month')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('challenges.form.duration')}</label>
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
              <label>{t('challenges.form.startsOn')}</label>
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
            <div className="form-step-label">{t('challenges.form.shelfBooks')}</div>
            {shelf.length === 0 ? (
              <div className="empty-state compact">
                <p>{t('challenges.form.emptyShelf')}</p>
                <Link to="/books/new" className="btn btn-secondary">
                  {t('challenges.form.addBook')}
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
              {t('app.save')}
            </button>
            <Link to={isEdit ? `/challenges/${id}` : '/challenges'} className="btn btn-ghost">
              {t('app.cancel')}
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
