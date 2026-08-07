import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import BookAddProgressOverlay from './components/BookAddProgressOverlay'

function useDebounced(value, ms = 280) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function SuggestItem({ item, onPick }) {
  const { t } = useTranslation()
  if (item.on_shelf && item.shelf_id) {
    return (
      <li>
        <Link to={`/books/${item.shelf_id}`} className="book-suggest-item">
          <span className="book-suggest-copy">
            <strong>{item.title || item.author}</strong>
            {item.title ? <small>{item.author} · {item.source_label || ''}</small> : null}
          </span>
          <span className="book-suggest-badge">{t('books.form.open')}</span>
        </Link>
      </li>
    )
  }
  return (
    <li>
      <button type="button" className="book-suggest-item" onClick={() => onPick(item)}>
        <span className="book-suggest-copy">
          <strong>{item.title || item.author}</strong>
          {item.title ? <small>{item.author} · {item.source_label || ''}</small> : null}
        </span>
        <span className="book-suggest-badge">{t('books.form.pick')}</span>
      </button>
    </li>
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForSetup(shelfId, onUpdate, { timeoutMs = 180000 } = {}) {
  const started = Date.now()
  let delay = 700
  while (Date.now() - started < timeoutMs) {
    const status = await booksApi.setupStatus(shelfId)
    onUpdate(status)
    if (status.ready) return status
    await sleep(delay)
    delay = Math.min(delay + 250, 2200)
  }
  return booksApi.setupStatus(shelfId).then((status) => {
    onUpdate(status)
    return status
  })
}

const STATUS_VALUES = ['want_to_read', 'reading', 'paused', 'finished', 'abandoned']

export default function BookFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { showToast } = useAuth()
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [similar, setSimilar] = useState([])
  const [matchResults, setMatchResults] = useState([])
  const [book, setBook] = useState(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [totalPages, setTotalPages] = useState(1)
  const [catalogId, setCatalogId] = useState('')
  const [bookSuggestions, setBookSuggestions] = useState([])
  const [authorSuggestions, setAuthorSuggestions] = useState([])
  const [journeyOpen, setJourneyOpen] = useState(false)
  const [journeySaving, setJourneySaving] = useState(false)
  const [journeySetup, setJourneySetup] = useState(null)
  const debouncedTitle = useDebounced(title)
  const debouncedAuthor = useDebounced(author)
  const excludeRef = useRef(null)

  useEffect(() => {
    if (!isEdit) return
    booksApi
      .detail(id)
      .then((data) => {
        setBook(data.book)
        setTitle(data.book.title)
        setAuthor(data.book.author)
        setTotalPages(data.book.total_pages || 1)
        excludeRef.current = data.book.book_id
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  useEffect(() => {
    if (debouncedTitle.length < 2) {
      setBookSuggestions([])
      return
    }
    booksApi
      .suggest({ q: debouncedTitle, scope: 'books' })
      .then((res) => setBookSuggestions(res.results || []))
      .catch(() => setBookSuggestions([]))
  }, [debouncedTitle])

  useEffect(() => {
    if (debouncedAuthor.length < 2) {
      setAuthorSuggestions([])
      return
    }
    booksApi
      .suggest({ q: debouncedAuthor, scope: 'authors' })
      .then((res) => setAuthorSuggestions(res.results || []))
      .catch(() => setAuthorSuggestions([]))
  }, [debouncedAuthor])

  useEffect(() => {
    if (debouncedTitle.length < 2 || debouncedAuthor.length < 2) {
      setMatchResults([])
      return
    }
    const params = {
      mode: 'match',
      title: debouncedTitle,
      author: debouncedAuthor,
    }
    if (excludeRef.current) params.exclude = String(excludeRef.current)
    booksApi
      .suggest(params)
      .then((res) => setMatchResults(res.results || []))
      .catch(() => setMatchResults([]))
  }, [debouncedTitle, debouncedAuthor])

  const fillFromSuggestion = (item) => {
    if (item.title) setTitle(item.title)
    if (item.author) setAuthor(item.author)
    if (item.total_pages) setTotalPages(item.total_pages)
    setCatalogId(item.id ? String(item.id) : '')
    setBookSuggestions([])
    setAuthorSuggestions([])
    setMatchResults([])
    setSimilar([])
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = e.target
    const fd = new FormData(form)
    if (catalogId) fd.set('catalog_book_id', catalogId)
    if (!fd.get('cover')?.size) fd.delete('cover')
    if (!form.confirm_similar?.checked) fd.delete('confirm_similar')
    else fd.set('confirm_similar', 'true')

    const isCreate = !isEdit
    if (isCreate) {
      setJourneyOpen(true)
      setJourneySaving(true)
      setJourneySetup(null)
    }

    try {
      const saved = isEdit ? await booksApi.update(id, fd) : await booksApi.create(fd)
      if (isCreate) {
        setJourneySaving(false)
        if (saved.setup) setJourneySetup(saved.setup)
        if (saved.await_setup) {
          await waitForSetup(saved.id, setJourneySetup)
          await sleep(650)
        } else if (saved.setup) {
          setJourneySetup({ ...saved.setup, ready: true, current_step: 'done' })
          await sleep(500)
        }
        showToast(t('books.form.addedToast'), 'success')
        navigate(`/books/${saved.id}`)
        return
      }
      showToast(t('books.form.updatedToast'), 'success')
      navigate(`/books/${saved.id}`)
    } catch (err) {
      setJourneyOpen(false)
      setJourneySaving(false)
      setJourneySetup(null)
      if (err instanceof ApiError) {
        setError(err.message)
        setSimilar(err.payload?.similar_matches || [])
      } else {
        setError(t('app.saveFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>{t('app.loading')}</p>

  return (
    <div className="page-book-form">
      <BookAddProgressOverlay
        open={journeyOpen}
        saving={journeySaving}
        setup={journeySetup}
        bookTitle={title}
      />
      <section className="section form-page">
        <div className="page-toolbar">
          <h1>{isEdit ? t('books.form.editTitle') : t('books.form.addTitle')}</h1>
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        {similar.length > 0 ? (
          <div className="book-dup-banner is-similar">
            <p>{t('books.form.similarFound')}</p>
            <ul>
              {similar.map((m) => (
                <li key={m.id}>
                  <strong>{m.title}</strong> — {m.author}{' '}
                  {m.on_shelf ? (
                    <Link to={`/books/${m.shelf_id}`}>{t('books.form.goToShelf')}</Link>
                  ) : (
                    <button type="button" className="btn btn-secondary" onClick={() => fillFromSuggestion(m)}>
                      {t('books.form.pickFromLibrary')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form className="form-panel" id="book-form" onSubmit={onSubmit}>
          <input type="hidden" name="catalog_book_id" value={catalogId} readOnly />
          <div className="form-step">
            <div className="form-step-label">
              <span className="form-step-num">1</span> {t('books.form.stepIdentity')}
            </div>
            <div className="form-grid two">
              <div className="field book-suggest-field">
                <label>{t('books.form.title')}</label>
                <input
                  name="title"
                  className="field-input"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setCatalogId('')
                  }}
                  required
                  autoComplete="off"
                />
                {bookSuggestions.length > 0 ? (
                  <div className="book-suggest-panel" data-suggest-panel="books">
                    <ul data-suggest-list>
                      {bookSuggestions.map((item) => (
                        <SuggestItem
                          key={`${item.id}-${item.title}`}
                          item={item}
                          onPick={fillFromSuggestion}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="field book-suggest-field">
                <label>{t('books.form.author')}</label>
                <input
                  name="author"
                  className="field-input"
                  value={author}
                  onChange={(e) => {
                    setAuthor(e.target.value)
                    setCatalogId('')
                  }}
                  required
                  autoComplete="off"
                />
                {authorSuggestions.length > 0 ? (
                  <div className="book-suggest-panel" data-suggest-panel="authors">
                    <ul data-suggest-list>
                      {authorSuggestions.map((item) => (
                        <li key={item.author}>
                          <button
                            type="button"
                            className="book-suggest-item"
                            onClick={() => {
                              setAuthor(item.author)
                              setAuthorSuggestions([])
                            }}
                          >
                            <span className="book-suggest-copy">
                              <strong>{item.author}</strong>
                              <small>{item.source_label || t('books.form.registeredAuthor')}</small>
                            </span>
                            <span className="book-suggest-badge">{t('books.form.pick')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            {matchResults.length > 0 ? (
              <div className="book-suggest-panel is-match" data-book-suggest>
                <p className="book-suggest-hint">{t('books.form.matchHint')}</p>
                <ul data-suggest-list="match">
                  {matchResults.map((item) => (
                    <SuggestItem key={`m-${item.id}`} item={item} onPick={fillFromSuggestion} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="form-step">
            <div className="form-step-label">
              <span className="form-step-num">2</span> {t('books.form.stepProgress')}
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>{t('books.form.totalPages')}</label>
                <input
                  name="total_pages"
                  type="number"
                  min="1"
                  className="field-input"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>{t('books.form.currentPage')}</label>
                <input
                  name="current_page"
                  type="number"
                  min="0"
                  className="field-input"
                  defaultValue={book?.current_page || 0}
                />
              </div>
              <div className="field">
                <label>{t('books.form.status')}</label>
                <select name="status" className="field-select" defaultValue={book?.status || 'want_to_read'}>
                  {STATUS_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t(`books.status.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t('books.form.cover')}</label>
                <input name="cover" type="file" accept="image/*" className="field-file" />
              </div>
            </div>
          </div>

          <div className="form-step">
            <div className="form-step-label">
              <span className="form-step-num">3</span> {t('books.form.stepNotes')}
            </div>
            <div className="field full">
              <textarea name="notes" className="field-textarea" rows={3} defaultValue={book?.notes || ''} />
            </div>
          </div>

          {similar.length > 0 ? (
            <label className="book-confirm-similar">
              <input type="checkbox" name="confirm_similar" /> {t('books.form.confirmSimilar')}
            </label>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('app.save')}
            </button>
            <Link to={isEdit ? `/books/${id}` : '/books'} className="btn btn-ghost">
              {t('app.cancel')}
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
