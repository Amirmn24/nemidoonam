/** کارت یادداشت مهروموم‌شده تا پایان کتاب */
export default function SealedEntryCard({ entry }) {
  return (
    <div className="sealed-entry">
      <div className="sealed-entry-mark" aria-hidden="true">
        <span />
      </div>
      <div className="sealed-entry-copy">
        <strong>مهروموم شده</strong>
        <p>
          این {entry.kind_display || 'یادداشت'} تا اتمام کتاب قفل است؛ بعد از پایان می‌توانی ببینی یا بشنوی.
        </p>
      </div>
    </div>
  )
}
