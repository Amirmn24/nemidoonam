import { useTranslation } from 'react-i18next'

/** گزینه‌های پرچم دیدگاه: عمومی و مهروموم */
export default function EntryFlagToggles({ isPublic, isSealed, onPublicChange, onSealedChange, showPublic = true }) {
  const { t } = useTranslation()
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
            <strong>{t('books.entry.public')}</strong>
            <small>{t('books.entry.publicHint')}</small>
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
          <strong>{t('books.entry.sealed')}</strong>
          <small>{t('books.entry.sealedHint')}</small>
        </span>
      </label>
    </div>
  )
}
