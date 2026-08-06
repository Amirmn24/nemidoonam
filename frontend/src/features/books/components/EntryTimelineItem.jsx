import { Link } from 'react-router-dom'
import SealedEntryCard from './SealedEntryCard'

/** یک آیتم تایم‌لاین یادداشت با پشتیبانی مهروموم و پرچم‌ها */
export default function EntryTimelineItem({ entry, bookId, onDelete }) {
  const locked = entry.is_content_locked

  return (
    <article
      className={`entry-item kind-${entry.kind}${entry.is_sealed ? ' is-sealed' : ''}${entry.is_public ? ' is-public' : ''}`}
    >
      <div className="cluster">
        <span className="tag">{entry.kind_display}</span>
        <span className="tag">{entry.media_type_display}</span>
        <span className="meta-pill">صفحه {entry.page_number}</span>
        <span className="meta-pill">{entry.entry_date}</span>
        {entry.is_public ? <span className="tag tag-public">عمومی</span> : null}
        {entry.is_sealed ? <span className="tag tag-sealed">مهروموم</span> : null}
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
        <Link className="text-link" to={`/books/${bookId}/entries/${entry.id}/edit`}>
          ویرایش
        </Link>
        <button type="button" className="text-link" onClick={() => onDelete(entry.id)}>
          حذف
        </button>
      </div>
    </article>
  )
}
