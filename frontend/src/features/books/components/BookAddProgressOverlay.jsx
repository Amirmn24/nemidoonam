import { useEffect, useMemo, useState } from 'react'

const STAGE_META = {
  shelf: {
    title: 'ثبت در قفسه',
    copy: 'کتاب دارد جای خودش را در قفسه‌ات پیدا می‌کند…',
  },
  cover: {
    title: 'پیدا کردن جلد',
    copy: 'داریم بین جلدهای ایرانی می‌گردیم تا روی کتاب بنشیند.',
  },
  vibe: {
    title: 'گراف شخصیت',
    copy: 'حس و حال مطالعه‌ات با این کتاب تازه می‌شود…',
  },
  done: {
    title: 'آماده شد',
    copy: 'همه‌چیز سر جایش است؛ بزن بریم سراغ کتاب.',
  },
}

function stageState(key, setup, saving) {
  if (key === 'shelf') {
    if (saving) return 'running'
    return setup ? 'done' : 'pending'
  }
  if (!setup) return 'pending'
  const map = {
    cover: setup.cover_status,
    vibe: setup.vibe_status,
    done: setup.ready ? 'done' : 'pending',
  }
  const raw = map[key] || 'pending'
  if (raw === 'skipped' || raw === 'failed') return raw === 'failed' ? 'failed' : 'done'
  return raw
}

/** لودینگ مرحله‌ای افزودن کتاب: قفسه → جلد → وایب */
export default function BookAddProgressOverlay({ open, saving, setup, bookTitle }) {
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!open) return undefined
    const t = setInterval(() => setPulse((n) => n + 1), 900)
    return () => clearInterval(t)
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

  const meta = STAGE_META[current] || STAGE_META.shelf
  const coverUrl = setup?.cover_url

  if (!open) return null

  const steps = ['shelf', 'cover', 'vibe', 'done']

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
          {current === 'vibe' || current === 'done' ? (
            <div className="book-journey-radar" data-pulse={pulse % 3}>
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>

        <p className="eyebrow">آماده‌سازی کتاب</p>
        <h2 id="journey-title">{meta.title}</h2>
        <p className="book-journey-copy">{meta.copy}</p>
        {bookTitle ? <p className="book-journey-title">{bookTitle}</p> : null}

        <ol className="book-journey-steps">
          {steps.map((key) => {
            const state = stageState(key, setup, saving)
            const label = STAGE_META[key].title
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
