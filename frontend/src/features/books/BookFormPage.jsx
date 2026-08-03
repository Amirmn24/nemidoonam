import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { booksApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'

function useDebounced(value, ms = 280) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function SuggestItem({ item, onPick }) {
  if (item.on_shelf && item.shelf_id) {
    return (
      <li>
        <Link to={`/books/${item.shelf_id}`} className="book-suggest-item">
          <span className="book-suggest-copy">
            <strong>{item.title || item.author}</strong>
            {item.title ? <small>{item.author} · {item.source_label || ''}</small> : null}
          </span>
          <span className="book-suggest-badge">باز کردن</span>
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
        <span className="book-suggest-badge">انتخاب</span>
      </button>
    </li>
  )
}

export default function BookFormPage() {
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

    try {
      const saved = isEdit ? await booksApi.update(id, fd) : await booksApi.create(fd)
      showToast(isEdit ? 'کتاب به‌روز شد.' : 'کتاب به قفسه اضافه شد.', 'success')
      navigate(`/books/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setSimilar(err.payload?.similar_matches || [])
      } else {
        setError('ذخیره ناموفق بود.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>در حال بارگذاری…</p>

  return (
    <div className="page-book-form">
      <section className="section form-page">
        <div className="page-toolbar">
          <h1>{isEdit ? 'ویرایش کتاب' : 'افزودن کتاب'}</h1>
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        {similar.length > 0 ? (
          <div className="book-dup-banner is-similar">
            <p>کتاب‌های شبیه پیدا شد:</p>
            <ul>
              {similar.map((m) => (
                <li key={m.id}>
                  <strong>{m.title}</strong> — {m.author}{' '}
                  {m.on_shelf ? (
                    <Link to={`/books/${m.shelf_id}`}>برو به قفسه</Link>
                  ) : (
                    <button type="button" className="btn btn-secondary" onClick={() => fillFromSuggestion(m)}>
                      انتخاب از کتابخانه
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
              <span className="form-step-num">۱</span> هویت کتاب
            </div>
            <div className="form-grid two">
              <div className="field book-suggest-field">
                <label>عنوان</label>
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
                <label>نویسنده</label>
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
                              <small>{item.source_label || 'نویسنده ثبت‌شده'}</small>
                            </span>
                            <span className="book-suggest-badge">انتخاب</span>
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
                <p className="book-suggest-hint">موارد شبیه در کتابخانه:</p>
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
              <span className="form-step-num">۲</span> پیشرفت و جلد
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>تعداد صفحات</label>
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
                <label>صفحه فعلی</label>
                <input
                  name="current_page"
                  type="number"
                  min="0"
                  className="field-input"
                  defaultValue={book?.current_page || 0}
                />
              </div>
              <div className="field">
                <label>وضعیت</label>
                <select name="status" className="field-select" defaultValue={book?.status || 'want_to_read'}>
                  <option value="want_to_read">می‌خواهم بخوانم</option>
                  <option value="reading">در حال خواندن</option>
                  <option value="paused">متوقف شده</option>
                  <option value="finished">تمام شده</option>
                  <option value="abandoned">رها شده</option>
                </select>
              </div>
              <div className="field">
                <label>جلد</label>
                <input name="cover" type="file" accept="image/*" className="field-file" />
              </div>
            </div>
          </div>

          <div className="form-step">
            <div className="form-step-label">
              <span className="form-step-num">۳</span> یادداشت کلی
            </div>
            <div className="field full">
              <textarea name="notes" className="field-textarea" rows={3} defaultValue={book?.notes || ''} />
            </div>
          </div>

          {similar.length > 0 ? (
            <label className="book-confirm-similar">
              <input type="checkbox" name="confirm_similar" /> مطمئنم این کتاب جدید است و با موارد پیشنهادی فرق دارد
            </label>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              ذخیره
            </button>
            <Link to={isEdit ? `/books/${id}` : '/'} className="btn btn-ghost">
              انصراف
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
