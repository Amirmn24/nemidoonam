import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi, challengesApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import { labelFromCode } from '../../i18n/labels'

const RESOURCE_KINDS = ['physical', 'ebook', 'booklet']
const DRAFT_KEY = 'challenge-form-draft'

function shelfKind(item) {
  return item.resource_kind || 'physical'
}

function shelfItemLabel(item) {
  const parts = [item.title]
  if (item.author) parts.push(item.author)
  if (item.course) parts.push(item.course)
  return parts.join(' — ')
}

function readDraft(challengeId) {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if ((draft.challengeId || null) !== (challengeId || null)) return null
    return draft
  } catch {
    return null
  }
}

function writeDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

export default function ChallengeFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useAuth()
  const [shelf, setShelf] = useState([])
  const [pickKind, setPickKind] = useState(null)
  const [selected, setSelected] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [periodUnit, setPeriodUnit] = useState('week')
  const [duration, setDuration] = useState(1)
  const [startsOn, setStartsOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const shelfData = await booksApi.list()
        const results = shelfData.results || []
        setShelf(results)

        const draft = readDraft(id || null)
        const addedRaw = searchParams.get('added')
        const addedId = addedRaw ? Number(addedRaw) : null
        const kindFromQuery = searchParams.get('kind')
        const validKind = RESOURCE_KINDS.includes(kindFromQuery) ? kindFromQuery : null

        if (isEdit) {
          const data = await challengesApi.detail(id)
          if (draft) {
            setTitle(draft.title || data.title || '')
            setDescription(draft.description || data.description || '')
            setPeriodUnit(draft.period_unit || data.period_unit || 'week')
            setDuration(draft.duration || data.duration || 1)
            setStartsOn(draft.starts_on || data.starts_on || '')
            setPickKind(validKind || draft.pickKind || null)
            const base = Array.isArray(draft.selected) ? draft.selected : []
            setSelected(
              addedId && !base.includes(addedId) ? [...base, addedId] : base,
            )
          } else {
            setTitle(data.title || '')
            setDescription(data.description || '')
            setPeriodUnit(data.period_unit || 'week')
            setDuration(data.duration || 1)
            setStartsOn(data.starts_on || '')
            const fromChallenge = data.books.map((b) => b.shelf_id).filter(Boolean)
            setSelected(
              addedId && !fromChallenge.includes(addedId)
                ? [...fromChallenge, addedId]
                : fromChallenge,
            )
            setPickKind(validKind)
          }
        } else if (draft) {
          setTitle(draft.title || '')
          setDescription(draft.description || '')
          setPeriodUnit(draft.period_unit || 'week')
          setDuration(draft.duration || 1)
          setStartsOn(draft.starts_on || new Date().toISOString().slice(0, 10))
          setPickKind(validKind || draft.pickKind || null)
          const base = Array.isArray(draft.selected) ? draft.selected : []
          setSelected(
            addedId && !base.includes(addedId) ? [...base, addedId] : base,
          )
        } else if (validKind) {
          setPickKind(validKind)
          if (addedId) setSelected([addedId])
        }

        if (addedRaw || kindFromQuery) {
          const next = new URLSearchParams(searchParams)
          next.delete('added')
          next.delete('kind')
          setSearchParams(next, { replace: true })
          clearDraft()
        }
      } catch (err) {
        setError(err.message || t('app.error'))
      } finally {
        setLoading(false)
      }
    }
    load()
    // فقط روی ورود به صفحه؛ searchParams را عمداً در deps نگذاشتیم تا بعد از پاک‌کردن query دوباره لود نشود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, t])

  const filteredShelf = useMemo(() => {
    if (!pickKind) return []
    return shelf.filter((b) => shelfKind(b) === pickKind)
  }, [shelf, pickKind])

  const selectedItems = useMemo(
    () => shelf.filter((b) => selected.includes(b.id)),
    [shelf, selected],
  )

  const kindCounts = useMemo(() => {
    const counts = { physical: 0, ebook: 0, booklet: 0 }
    for (const b of shelf) counts[shelfKind(b)] = (counts[shelfKind(b)] || 0) + 1
    return counts
  }, [shelf])

  const selectedByKind = useMemo(() => {
    const counts = { physical: 0, ebook: 0, booklet: 0 }
    for (const b of selectedItems) counts[shelfKind(b)] = (counts[shelfKind(b)] || 0) + 1
    return counts
  }, [selectedItems])

  const toggle = (shelfId) => {
    setSelected((prev) =>
      prev.includes(shelfId) ? prev.filter((x) => x !== shelfId) : [...prev, shelfId],
    )
  }

  const saveDraftAndGoAdd = () => {
    if (!pickKind) return
    writeDraft({
      challengeId: id || null,
      title,
      description,
      period_unit: periodUnit,
      duration,
      starts_on: startsOn,
      selected,
      pickKind,
    })
    const returnTo = isEdit ? `/challenges/${id}/edit` : '/challenges/new'
    navigate(
      `/books/new?kind=${encodeURIComponent(pickKind)}&returnTo=${encodeURIComponent(returnTo)}`,
    )
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      title,
      description,
      period_unit: periodUnit,
      duration: Number(duration),
      starts_on: startsOn,
      shelf_ids: selected,
    }
    try {
      const saved = isEdit
        ? await challengesApi.update(id, body)
        : await challengesApi.create(body)
      clearDraft()
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
            <input
              name="title"
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>{t('challenges.form.description')}</label>
            <textarea
              name="description"
              className="field-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>{t('challenges.form.periodUnit')}</label>
              <select
                name="period_unit"
                className="field-select"
                value={periodUnit}
                onChange={(e) => setPeriodUnit(e.target.value)}
              >
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
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>{t('challenges.form.startsOn')}</label>
              <input
                name="starts_on"
                type="date"
                className="field-input"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-step challenge-pick-step">
            <div className="form-step-label">{t('challenges.form.pickKind')}</div>
            <p className="form-hint">{t('challenges.form.pickKindHint')}</p>
            <div className="choice-grid resource-kind-grid challenge-kind-grid">
              {RESOURCE_KINDS.map((kind) => {
                const active = pickKind === kind
                const shelfCount = kindCounts[kind] || 0
                const picked = selectedByKind[kind] || 0
                return (
                  <button
                    key={kind}
                    type="button"
                    className={`choice-card resource-kind-card${active ? ' is-active' : ''}`}
                    onClick={() => setPickKind(kind)}
                  >
                    <strong>{t(`books.resourceKind.${kind}`)}</strong>
                    <small>
                      {t('challenges.form.kindShelfCount', { count: shelfCount })}
                      {picked > 0
                        ? ` · ${t('challenges.form.kindSelectedCount', { count: picked })}`
                        : ''}
                    </small>
                  </button>
                )
              })}
            </div>

            {pickKind ? (
              <>
                <div className="challenge-pick-toolbar">
                  <div className="form-step-label">
                    {t('challenges.form.shelfForKind', {
                      kind: t(`books.resourceKind.${pickKind}`),
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={saveDraftAndGoAdd}
                  >
                    {t('challenges.form.addOfKind', {
                      kind: t(`books.resourceKind.${pickKind}`),
                    })}
                  </button>
                </div>

                {filteredShelf.length === 0 ? (
                  <div className="empty-state compact">
                    <p>{t('challenges.form.emptyKindShelf')}</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={saveDraftAndGoAdd}
                    >
                      {t('challenges.form.addOfKind', {
                        kind: t(`books.resourceKind.${pickKind}`),
                      })}
                    </button>
                  </div>
                ) : (
                  <div className="book-pick-list">
                    {filteredShelf.map((b) => (
                      <label key={b.id} className="book-pick-item">
                        <input
                          type="checkbox"
                          checked={selected.includes(b.id)}
                          onChange={() => toggle(b.id)}
                        />
                        <span>{shelfItemLabel(b)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {selectedItems.length > 0 ? (
              <div className="challenge-selected-summary">
                <div className="form-step-label">
                  {t('challenges.form.selectedSummary', { count: selectedItems.length })}
                </div>
                <ul>
                  {selectedItems.map((b) => (
                    <li key={b.id}>
                      <span>{shelfItemLabel(b)}</span>
                      <span className="tag">{t(`books.resourceKind.${shelfKind(b)}`)}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-compact"
                        onClick={() => toggle(b.id)}
                      >
                        {t('app.remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
