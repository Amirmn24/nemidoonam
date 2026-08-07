import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STAGE_KEYS = ['shelf', 'cover', 'done']

function stageState(key, setup, saving) {
  if (key === 'shelf') {
    if (saving) return 'running'
    return setup ? 'done' : 'pending'
  }
  if (!setup) return 'pending'
  const map = {
    cover: setup.cover_status,
    done: setup.ready ? 'done' : 'pending',
  }
  const raw = map[key] || 'pending'
  if (raw === 'skipped' || raw === 'failed') return raw === 'failed' ? 'failed' : 'done'
  return raw
}

/** لودینگ مرحله‌ای افزودن کتاب: قفسه → جلد (وایب در پس‌زمینه) */
export default function BookAddProgressOverlay({ open, saving, setup, bookTitle }) {
  const { t } = useTranslation()
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => setPulse((n) => n + 1), 900)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const current = useMemo(() => {
    if (saving || !setup) return 'shelf'
    return setup.current_step || 'cover'
  }, [saving, setup])

  const metaKey = STAGE_KEYS.includes(current) ? current : 'shelf'
  const coverUrl = setup?.cover_url

  if (!open) return null

  return (
    <div className="book-journey" role="dialog" aria-modal="true" aria-labelledby="journey-title">
      <div className="book-journey-backdrop" />
      <div className="book-journey-sheet">
        <div className="book-journey-orbit" aria-hidden="true">
          <span className="book-journey-ring" />
          <span className="book-journey-ring is-delay" />
          <div className={`book-journey-core is-${current}`}>
            {coverUrl && current !== 'shelf' ? (
              <img src={coverUrl} alt="" className="book-journey-cover" />
            ) : (
              <div className="book-journey-book">
                <span className="book-journey-book-spine" />
                <span className="book-journey-book-page" />
              </div>
            )}
          </div>
          {current === 'done' ? (
            <div className="book-journey-radar" data-pulse={pulse % 3}>
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>

        <p className="eyebrow">{t('books.setup.eyebrow')}</p>
        <h2 id="journey-title">{t(`books.setup.${metaKey}.title`)}</h2>
        <p className="book-journey-copy">{t(`books.setup.${metaKey}.copy`)}</p>
        {bookTitle ? <p className="book-journey-title">{bookTitle}</p> : null}

        <ol className="book-journey-steps">
          {STAGE_KEYS.map((key) => {
            const state = stageState(key, setup, saving)
            const label = t(`books.setup.${key}.title`)
            return (
              <li key={key} className={`book-journey-step is-${state}${current === key ? ' is-current' : ''}`}>
                <span className="book-journey-step-dot" />
                <span className="book-journey-step-label">{label}</span>
                <span className="book-journey-step-status">
                  {state === 'running' || (state === 'pending' && current === key)
                    ? '…'
                    : state === 'done'
                      ? '✓'
                      : state === 'failed'
                        ? '!'
                        : ''}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
