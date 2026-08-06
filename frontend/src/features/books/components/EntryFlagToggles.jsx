/** گزینه‌های پرچم دیدگاه: عمومی و مهروموم */
export default function EntryFlagToggles({ isPublic, isSealed, onPublicChange, onSealedChange, showPublic = true }) {
  return (
    <div className="entry-flag-grid">
      {showPublic ? (
        <label className={`entry-flag${isPublic ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => onPublicChange(e.target.checked)}
          />
          <span className="entry-flag-body">
            <strong>عمومی</strong>
            <small>برای اشتراک‌گذاری بعدی علامت بزن</small>
          </span>
        </label>
      ) : null}
      <label className={`entry-flag entry-flag-seal${isSealed ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={isSealed}
          onChange={(e) => onSealedChange(e.target.checked)}
        />
        <span className="entry-flag-body">
          <strong>مهروموم</strong>
          <small>تا پایان کتاب دیده و شنیده نمی‌شود</small>
        </span>
      </label>
    </div>
  )
}
