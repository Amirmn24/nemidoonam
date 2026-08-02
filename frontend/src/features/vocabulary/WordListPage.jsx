import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { vocabularyApi } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'

export default function WordListPage() {
  const { showToast } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const [flipped, setFlipped] = useState({})
  const [usageModal, setUsageModal] = useState(null)
  const q = params.get('q') || ''

  const load = () =>
    vocabularyApi
      .list({ q: q || undefined })
      .then(setData)
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [q])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setUsageModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onSearch = (e) => {
    e.preventDefault()
    const value = new FormData(e.target).get('q') || ''
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const onDelete = async (id) => {
    if (!window.confirm('واژه حذف شود؟')) return
    await vocabularyApi.remove(id)
    showToast('حذف شد.')
    await load()
  }

  const playAudio = (src) => {
    const audio = new Audio(src)
    audio.play()
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!data) return <p>در حال بارگذاری…</p>

  return (
    <div className="page-vocabulary">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">واژه‌نامه</p>
          <h1>فلش‌کارت‌های تو</h1>
          <div className="cluster">
            <Link to="/vocabulary/new" className="btn btn-primary btn-lg">
              واژه جدید
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <strong>{data.total_count}</strong>
            <span>واژه</span>
          </div>
          <div>
            <strong>{data.with_audio_count}</strong>
            <span>با تلفظ</span>
          </div>
        </div>
      </section>

      <section className="section" id="vocab-list">
        <form className="vocab-search" onSubmit={onSearch}>
          <input
            name="q"
            className="field-input"
            placeholder="جستجو در واژه یا معنی…"
            defaultValue={q}
          />
        </form>

        {data.results.length === 0 ? (
          <div className="empty-state">
            <h3>واژه‌ای نیست</h3>
            <Link to="/vocabulary/new" className="btn btn-secondary">
              افزودن
            </Link>
          </div>
        ) : (
          <div className="flashcard-grid" data-flashcards>
            {data.results.map((word) => (
              <article
                key={word.id}
                className={`flashcard${flipped[word.id] ? ' is-flipped' : ''}`}
              >
                <div className="flashcard-inner">
                  <button
                    type="button"
                    className="flashcard-face flashcard-front"
                    onClick={() => setFlipped((f) => ({ ...f, [word.id]: !f[word.id] }))}
                  >
                    <span className="flashcard-kicker">واژه</span>
                    <strong className="flashcard-term">{word.term}</strong>
                    <span className="flashcard-hint">برای معنی ضربه بزن</span>
                  </button>
                  <button
                    type="button"
                    className="flashcard-face flashcard-back"
                    onClick={() => setFlipped((f) => ({ ...f, [word.id]: !f[word.id] }))}
                  >
                    <span className="flashcard-kicker">معنی</span>
                    <p className="flashcard-meaning">{word.meaning}</p>
                  </button>
                </div>
                <div className="flashcard-actions">
                  {word.has_usage ? (
                    <button
                      type="button"
                      className="flashcard-action"
                      onClick={() => setUsageModal(word)}
                    >
                      کاربرد
                    </button>
                  ) : null}
                  {word.has_audio ? (
                    <button
                      type="button"
                      className="flashcard-action"
                      onClick={() => playAudio(word.audio_url)}
                    >
                      پخش
                    </button>
                  ) : null}
                  <Link to={`/vocabulary/${word.id}/edit`} className="flashcard-action">
                    ویرایش
                  </Link>
                  <button
                    type="button"
                    className="flashcard-action is-danger"
                    onClick={() => onDelete(word.id)}
                  >
                    حذف
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {usageModal ? (
        <div className="vocab-modal" role="dialog">
          <div className="vocab-modal-backdrop" onClick={() => setUsageModal(null)} />
          <div className="vocab-modal-sheet">
            <button type="button" onClick={() => setUsageModal(null)}>
              بستن
            </button>
            <h3>{usageModal.term}</h3>
            <p>{usageModal.usage}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
