import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { labelFromCode } from '../../../i18n/labels'

/** مودال پژواک: محتوا بدون نام کتاب، سپس آشکارسازی و افزودن به قفسه */
export default function EchoModal({
  open,
  busy,
  status,
  claim,
  empty,
  error,
  onDraw,
  onReveal,
  onSave,
  onDismiss,
  onClose,
}) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onClose])

  if (!open) return null

  const content = claim?.content
  const revealed = Boolean(claim?.book_revealed && content?.book)
  const isVoice = content?.media_type === 'voice'
  const windowLabel = status?.window
    ? t('books.echo.windowHint', { start: status.window.start, end: status.window.end })
    : ''

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="echo-title">
      <div className="book-modal-backdrop" onClick={busy ? undefined : onClose} />
      <div className="book-modal-sheet echo-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.echo.eyebrow')}</p>
            <h2 id="echo-title">{t('books.echo.title')}</h2>
          </div>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose} aria-label={t('app.close')}>
            {t('app.close')}
          </button>
        </div>

        {windowLabel ? <p className="echo-window-hint">{windowLabel}</p> : null}
        {error ? <p className="form-errors">{error}</p> : null}

        {!claim && !empty && !busy ? (
          <p className="echo-intro">{t('books.echo.intro')}</p>
        ) : null}

        {busy && !claim && !empty ? <p className="peer-viewpoint-loading">{t('books.echo.loading')}</p> : null}

        {empty ? (
          <div className="peer-viewpoint-empty">
            <p>{t('books.echo.empty')}</p>
          </div>
        ) : null}

        {content ? (
          <figure className="peer-viewpoint-card echo-card">
            {content.kind ? (
              <span className="tag">
                {labelFromCode('books.kind', content.kind, content.kind)}
              </span>
            ) : null}
            {isVoice && content.audio_url ? (
              <audio key={claim.token} controls autoPlay src={content.audio_url} className="peer-viewpoint-audio" />
            ) : null}
            {!isVoice && content.text ? (
              <blockquote>
                <p>{content.text}</p>
              </blockquote>
            ) : null}

            {revealed ? (
              <figcaption className="echo-book-reveal">
                {content.book.cover_url ? (
                  <img src={content.book.cover_url} alt="" className="echo-book-cover" />
                ) : (
                  <div className="echo-book-cover echo-book-cover-fallback" />
                )}
                <div>
                  <strong>{content.book.title}</strong>
                  <span>{content.book.author}</span>
                </div>
              </figcaption>
            ) : (
              <figcaption className="echo-book-hidden">
                <span>{t('books.echo.bookHidden')}</span>
              </figcaption>
            )}
          </figure>
        ) : null}

        <div className="form-actions echo-actions">
          {!claim && !empty ? (
            <button type="button" className="btn btn-primary" disabled={busy || !status?.can_draw} onClick={onDraw}>
              {busy ? t('books.echo.busyEllipsis') : t('books.echo.draw')}
            </button>
          ) : null}

          {claim && claim.resolution === 'open' && !revealed ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onReveal}>
              {t('books.echo.revealBook')}
            </button>
          ) : null}

          {claim && claim.resolution === 'open' && revealed ? (
            <>
              {claim.already_on_shelf ? (
                <p className="echo-on-shelf">{t('books.echo.alreadyOnShelf')}</p>
              ) : (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={onSave}>
                  {t('books.echo.wantToRead')}
                </button>
              )}
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={onDismiss}>
                {t('books.echo.skip')}
              </button>
            </>
          ) : null}

          {claim && claim.resolution !== 'open' ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
              {t('app.close')}
            </button>
          ) : null}

          {claim && claim.resolution === 'open' && !revealed ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDismiss}>
              {t('books.echo.skip')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
