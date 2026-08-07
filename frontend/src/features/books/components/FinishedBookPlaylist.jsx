import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { labelFromCode } from '../../../i18n/labels'

function entryPreview(entry, t) {
  if (entry.kind === 'ending_prediction') return t('books.playlist.previewMidpoint')
  if (entry.kind === 'final_viewpoint') return t('books.playlist.previewFinal')
  if (entry.text_content) {
    const text = entry.text_content.trim()
    return text.length > 48 ? `${text.slice(0, 48)}…` : text
  }
  if (entry.media_type === 'voice') return t('books.playlist.previewVoice')
  if (entry.media_type === 'image') return t('books.playlist.previewImage')
  return labelFromCode('books.kind', entry.kind, entry.kind_display)
}

function PlaylistStage({ entry }) {
  const { t } = useTranslation()

  if (!entry) {
    return (
      <div className="playlist-empty">
        <h3>{t('books.playlist.emptyTitle')}</h3>
        <p>{t('books.playlist.emptyBody')}</p>
      </div>
    )
  }

  return (
    <div className={`playlist-stage kind-${entry.kind}`}>
      <div className="playlist-stage-meta">
        <span className="tag">{labelFromCode('books.kind', entry.kind, entry.kind_display)}</span>
        <span className="tag">{labelFromCode('books.media', entry.media_type, entry.media_type_display)}</span>
        <span className="meta-pill">{t('books.entry.pagePill', { page: entry.page_number })}</span>
        <span className="meta-pill">{entry.entry_date}</span>
        {entry.is_sealed ? <span className="tag tag-sealed">{t('books.playlist.wasSealed')}</span> : null}
      </div>
      {entry.kind === 'ending_prediction' ? (
        <p className="playlist-prediction-banner">{t('books.playlist.predictionBanner')}</p>
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
  const { t } = useTranslation()
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
          <p className="eyebrow">{t('books.playlist.eyebrow')}</p>
          <h2>{t('books.playlist.title')}</h2>
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
                {t('books.playlist.prev')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => go(1)}>
                {t('books.playlist.next')}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="playlist-tracks surface surface-muted">
          <h3>{t('books.playlist.trackList')}</h3>
          {!hasTracks ? (
            <p className="field-hint">{t('books.playlist.nothingToPlay')}</p>
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
                      <strong>{labelFromCode('books.kind', entry.kind, entry.kind_display)}</strong>
                      <small>{entryPreview(entry, t)}</small>
                    </span>
                    <span className="playlist-track-page">{t('books.playlist.pageShort', { page: entry.page_number })}</span>
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
