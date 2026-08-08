import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { labelFromCode } from '../../../i18n/labels'
import SealedEntryCard from './SealedEntryCard'

const SHAREABLE_KINDS = new Set(['viewpoint', 'feeling', 'book_text'])

/** یک آیتم تایم‌لاین یادداشت با پشتیبانی مهروموم، عمومی‌سازی و پرچم‌ها */
export default function EntryTimelineItem({ entry, bookId, onDelete, onAskPublish }) {
  const { t } = useTranslation()
  const locked = entry.is_content_locked
  const canPublish =
    Boolean(onAskPublish) &&
    !entry.is_public &&
    !entry.is_sealed &&
    !locked &&
    SHAREABLE_KINDS.has(entry.kind)

  return (
    <article
      className={`entry-item kind-${entry.kind}${entry.is_sealed ? ' is-sealed' : ''}${entry.is_public ? ' is-public' : ''}`}
    >
      <div className="cluster">
        <span className="tag">{labelFromCode('books.kind', entry.kind, entry.kind_display)}</span>
        <span className="tag">{labelFromCode('books.media', entry.media_type, entry.media_type_display)}</span>
        <span className="meta-pill">{t('books.entry.pagePill', { page: entry.page_number })}</span>
        <span className="meta-pill">{entry.entry_date}</span>
        {entry.is_public ? <span className="tag tag-public">{t('books.entry.public')}</span> : null}
        {entry.is_sealed ? <span className="tag tag-sealed">{t('books.entry.sealed')}</span> : null}
      </div>

      {locked ? (
        <SealedEntryCard entry={entry} />
      ) : (
        <>
          {entry.media_type === 'image' && entry.image_url ? (
            <img src={entry.image_url} alt="" className="entry-inline-image" />
          ) : null}
          {entry.media_type === 'voice' && entry.audio_url ? (
            <audio controls src={entry.audio_url} />
          ) : null}
          {entry.text_content ? <p>{entry.text_content}</p> : null}
        </>
      )}

      <div className="cluster">
        {canPublish ? (
          <button type="button" className="text-link" onClick={() => onAskPublish(entry)}>
            {t('books.entry.makePublic')}
          </button>
        ) : null}
        <Link className="text-link" to={`/books/${bookId}/entries/${entry.id}/edit`}>
          {t('app.edit')}
        </Link>
        <button type="button" className="text-link" onClick={() => onDelete(entry.id)}>
          {t('app.delete')}
        </button>
      </div>
    </article>
  )
}
