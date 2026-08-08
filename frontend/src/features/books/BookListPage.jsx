import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi, ApiError } from '../../shared/api'
import { labelFromCode } from '../../i18n/labels'
import { useAuth } from '../../shared/AuthContext'
import { RatingBadge } from './components/BookRatingPanel'
import EchoModal from './components/EchoModal'

export default function BookListPage() {
  const { t } = useTranslation()
  const { showToast } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const active = params.get('status') || ''

  const [echoOpen, setEchoOpen] = useState(false)
  const [echoBusy, setEchoBusy] = useState(false)
  const [echoStatus, setEchoStatus] = useState(null)
  const [echoClaim, setEchoClaim] = useState(null)
  const [echoEmpty, setEchoEmpty] = useState(false)
  const [echoError, setEchoError] = useState('')

  useEffect(() => {
    booksApi
      .list()
      .then(setData)
      .catch((err) => setError(err.message || t('app.error')))
  }, [t])

  useEffect(() => {
    booksApi
      .echoStatus()
      .then((status) => {
        setEchoStatus(status)
        if (status.claim) setEchoClaim(status.claim)
      })
      .catch(() => {
        /* پژواک اختیاری است؛ قفسه را بلاک نکن */
      })
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    if (!active) return data.results
    return data.results.filter((b) => b.status === active)
  }, [data, active])

  const setStatus = (status) => {
    const next = new URLSearchParams(params)
    if (status) next.set('status', status)
    else next.delete('status')
    setParams(next, { replace: true })
  }

  const openEcho = () => {
    setEchoError('')
    setEchoEmpty(false)
    setEchoOpen(true)
    if (echoStatus?.claim) setEchoClaim(echoStatus.claim)
  }

  const applyEchoStatus = useCallback((status) => {
    if (!status) return
    setEchoStatus(status)
    if (status.claim) setEchoClaim(status.claim)
  }, [])

  const onEchoDraw = async () => {
    setEchoBusy(true)
    setEchoError('')
    setEchoEmpty(false)
    try {
      const res = await booksApi.echoDraw()
      applyEchoStatus(res.status)
      if (res.empty) {
        setEchoEmpty(true)
        setEchoClaim(null)
      } else {
        setEchoClaim(res.claim)
      }
    } catch (err) {
      setEchoError(err instanceof ApiError ? err.message : t('books.echo.failed'))
      if (err instanceof ApiError && err.payload?.status) applyEchoStatus(err.payload.status)
    } finally {
      setEchoBusy(false)
    }
  }

  const onEchoReveal = async () => {
    if (!echoClaim?.token) return
    setEchoBusy(true)
    setEchoError('')
    try {
      const res = await booksApi.echoReveal(echoClaim.token)
      setEchoClaim(res.claim)
      applyEchoStatus(res.status)
    } catch (err) {
      setEchoError(err instanceof ApiError ? err.message : t('books.echo.failed'))
    } finally {
      setEchoBusy(false)
    }
  }

  const onEchoSave = async () => {
    if (!echoClaim?.token) return
    setEchoBusy(true)
    setEchoError('')
    try {
      const res = await booksApi.echoSave(echoClaim.token)
      setEchoClaim(res.claim)
      applyEchoStatus(res.status)
      showToast(
        res.created ? t('books.echo.savedToast') : t('books.echo.alreadyOnShelfToast'),
        'success',
      )
      const shelf = await booksApi.list()
      setData(shelf)
    } catch (err) {
      setEchoError(err instanceof ApiError ? err.message : t('books.echo.failed'))
    } finally {
      setEchoBusy(false)
    }
  }

  const onEchoDismiss = async () => {
    if (!echoClaim?.token) return
    setEchoBusy(true)
    setEchoError('')
    try {
      const res = await booksApi.echoDismiss(echoClaim.token)
      setEchoClaim(res.claim)
      applyEchoStatus(res.status)
      setEchoOpen(false)
    } catch (err) {
      setEchoError(err instanceof ApiError ? err.message : t('books.echo.failed'))
    } finally {
      setEchoBusy(false)
    }
  }

  if (error) return <p className="form-errors">{error}</p>
  if (!data) return <p>{t('books.list.loading')}</p>

  const echoActive = Boolean(echoStatus?.active)
  const echoCanDraw = Boolean(echoStatus?.can_draw)
  const echoUsed = Boolean(echoStatus?.used_tonight)
  const echoHasOpen = Boolean(echoStatus?.claim)

  return (
    <div className="page-home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t('books.list.eyebrow')}</p>
          <h1>{t('books.list.title')}</h1>
          <p>{t('books.list.subtitle')}</p>
          <div className="cluster">
            <Link to="/books/new" className="btn btn-primary btn-lg">
              {t('books.list.addBook')}
            </Link>
            <button
              type="button"
              className={`btn btn-secondary btn-lg echo-trigger${echoActive ? '' : ' is-disabled'}`}
              disabled={!echoActive && !echoHasOpen}
              title={
                echoActive
                  ? echoUsed && !echoHasOpen
                    ? t('books.echo.usedTonight')
                    : t('books.echo.ctaHint')
                  : t('books.echo.inactiveHint')
              }
              onClick={openEcho}
            >
              {t('books.echo.cta')}
            </button>
          </div>
          {echoStatus ? (
            <p className="echo-status-line">
              {echoActive
                ? echoCanDraw || echoHasOpen
                  ? t('books.echo.activeHint')
                  : t('books.echo.usedTonight')
                : t('books.echo.inactiveHint')}
            </p>
          ) : null}
        </div>
        {data.total_count > 0 ? (
          <div className="hero-stats">
            <div>
              <strong>{data.total_count}</strong>
              <span>{t('books.list.statBooks')}</span>
            </div>
            <div>
              <strong>{data.reading_count}</strong>
              <span>{t('books.list.statReading')}</span>
            </div>
            <div>
              <strong>{data.finished_count}</strong>
              <span>{t('books.list.statFinished')}</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section library" id="library">
        <div className="page-toolbar">
          <h2>{t('books.list.shelf')}</h2>
        </div>
        <div className="filter-bar">
          <button type="button" className={`chip${!active ? ' is-active' : ''}`} onClick={() => setStatus('')}>
            {t('app.all')}
          </button>
          {data.statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`chip${active === s.value ? ' is-active' : ''}`}
              onClick={() => setStatus(s.value)}
            >
              {labelFromCode('books.status', s.value, s.label)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{t('books.list.emptyTitle')}</h3>
            <p>{t('books.list.emptyBody')}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setStatus('')}>
              {t('books.list.showAll')}
            </button>
          </div>
        ) : (
          <div className="book-grid">
            {filtered.map((book) => (
              <Link key={book.id} to={`/books/${book.id}`} className="book-tile">
                <div className="book-cover">
                  {book.cover_url ? <img src={book.cover_url} alt="" /> : <div className="cover-fallback" />}
                </div>
                <div className="book-meta">
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <div className="cluster">
                    <span className={`status status-${book.status}`}>
                      {labelFromCode('books.status', book.status, book.status_display)}
                    </span>
                    <RatingBadge score={book.overall_score} />
                  </div>
                  <div className="book-progress-label">
                    {t('books.list.progressLabel', {
                      current: book.current_page,
                      total: book.total_pages,
                      percent: book.progress_percent,
                    })}
                  </div>
                  <div className="progress">
                    <span style={{ width: `${book.progress_percent}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <EchoModal
        open={echoOpen}
        busy={echoBusy}
        status={echoStatus}
        claim={echoClaim}
        empty={echoEmpty}
        error={echoError}
        onDraw={onEchoDraw}
        onReveal={onEchoReveal}
        onSave={onEchoSave}
        onDismiss={onEchoDismiss}
        onClose={() => setEchoOpen(false)}
      />
    </div>
  )
}
