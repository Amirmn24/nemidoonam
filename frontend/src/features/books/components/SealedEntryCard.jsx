import { useTranslation } from 'react-i18next'
import { labelFromCode } from '../../../i18n/labels'

/** کارت یادداشت مهروموم‌شده تا پایان کتاب */
export default function SealedEntryCard({ entry }) {
  const { t } = useTranslation()
  const kindLabel = labelFromCode('books.kind', entry.kind, entry.kind_display) || t('books.entry.kindFallback')
  return (
    <div className="sealed-entry">
      <div className="sealed-entry-mark" aria-hidden="true">
        <span />
      </div>
      <div className="sealed-entry-copy">
        <strong>{t('books.entry.sealedTitle')}</strong>
        <p>{t('books.entry.sealedBody', { kind: kindLabel })}</p>
      </div>
    </div>
  )
}
