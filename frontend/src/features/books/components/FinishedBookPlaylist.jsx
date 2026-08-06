import { useEffect, useMemo, useState } from 'react'

function entryPreview(entry) {
  if (entry.kind === 'ending_prediction') return 'پیش‌بینی نیمه‌راه'
  if (entry.text_content) {
    const t = entry.text_content.trim()
    return t.length > 48 ? `${t.slice(0, 48)}…` : t
  }
  if (entry.media_type === 'voice') return 'یادداشت صوتی'
  if (entry.media_type === 'image') return 'یادداشت تصویری'
  return entry.kind_display
}

function PlaylistStage({ entry }) {
  if (!entry) {
    return (
      <div className="playlist-empty">
        <h3>هنوز یادداشتی نیست</h3>
        <p>برای این کتاب دیدگاهی ثبت نشده.</p>
      </div>
    )
  }

  return (
    <div className={`playlist-stage kind-${entry.kind}`}>
      <div className="playlist-stage-meta">
        <span className="tag">{entry.kind_display}</span>
        <span className="tag">{entry.media_type_display}</span>
        <span className="meta-pill">صفحه {entry.page_number}</span>
        <span className="meta-pill">{entry.entry_date}</span>
        {entry.is_sealed ? <span className="tag tag-sealed">قبلاً مهروموم</span> : null}
      </div>
      {entry.kind === 'ending_prediction' ? (
        <p className="playlist-prediction-banner">پیش‌بینی تو در نیمه‌راه کتاب</p>
      ) : null}
      {entry.media_type === 'image' && entry.image_url ? (
        <img src={entry.image_url} alt="" className="playlist-stage-image" />
      ) : null}
      {entry.media_type === 'voice' && entry.audio_url ? (
        <audio key={entry.id} controls autoPlay src={entry.audio_url} className="playlist-stage-audio" />
      ) : null}
      {entry.text_content ? <p className="playlist-stage-text">{entry.text_content}</p> : null}
    </div>
  )
}

/** پلی‌لیست روایی یادداشت‌ها بعد از اتمام کتاب */
export default function FinishedBookPlaylist({ entries }) {
  const tracks = useMemo(() => entries || [], [entries])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [tracks])

  const current = tracks[index] || null
  const hasTracks = tracks.length > 0

  const go = (next) => {
    if (!hasTracks) return
    setIndex((i) => (i + next + tracks.length) % tracks.length)
  }

  return (
    <section className="playlist-shell" id="playlist">
      <div className="playlist-toolbar">
        <div>
          <p className="eyebrow">مرور بعد از اتمام</p>
          <h2>پلی‌لیست یادداشت‌ها</h2>
        </div>
        {hasTracks ? (
          <div className="playlist-counter">
            {index + 1} / {tracks.length}
          </div>
        ) : null}
      </div>

      <div className="playlist-layout">
        <div className="playlist-player surface">
          <PlaylistStage entry={current} />
          {hasTracks ? (
            <div className="playlist-controls">
              <button type="button" className="btn btn-ghost" onClick={() => go(-1)}>
                قبلی
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => go(1)}>
                بعدی
              </button>
            </div>
          ) : null}
        </div>

        <aside className="playlist-tracks surface surface-muted">
          <h3>فهرست</h3>
          {!hasTracks ? (
            <p className="field-hint">موردی برای پخش نیست.</p>
          ) : (
            <ol className="playlist-track-list">
              {tracks.map((entry, i) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`playlist-track${i === index ? ' is-active' : ''}${entry.kind === 'ending_prediction' ? ' is-prediction' : ''}`}
                    onClick={() => setIndex(i)}
                  >
                    <span className="playlist-track-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="playlist-track-copy">
                      <strong>{entry.kind_display}</strong>
                      <small>{entryPreview(entry)}</small>
                    </span>
                    <span className="playlist-track-page">ص {entry.page_number}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  )
}
