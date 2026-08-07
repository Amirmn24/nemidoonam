import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { labelFromCode } from '../../../i18n/labels'

const DEFAULT_FACTOR_KEYS = ['writing', 'content', 'characters', 'pacing', 'impact']

function ScoreStars({ value, onChange, name }) {
  const { t } = useTranslation()
  return (
    <div className="rating-stars" role="group" aria-label={name}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`rating-star${value >= n ? ' is-on' : ''}`}
          onClick={() => onChange(n)}
          aria-label={t('books.rating.starAria', { n })}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function BookRatingPanel({
  factors,
  rating,
  canRate,
  busy,
  onSubmit,
}) {
  const { t } = useTranslation()

  const resolvedFactors = useMemo(() => {
    const source = factors?.length
      ? factors
      : DEFAULT_FACTOR_KEYS.map((key) => ({ key }))
    return source.map((f) => ({
      key: f.key,
      label: labelFromCode('books.factors', f.key, f.label),
    }))
  }, [factors, t])

  const initial = useMemo(() => {
    const scores = {}
    for (const f of resolvedFactors) {
      const fromRating = rating?.factors?.find((x) => x.key === f.key)?.score
      scores[f.key] = fromRating || 3
    }
    return { scores, review: rating?.review || '' }
  }, [resolvedFactors, rating])

  const [scores, setScores] = useState(initial.scores)
  const [review, setReview] = useState(initial.review)

  useEffect(() => {
    setScores(initial.scores)
    setReview(initial.review)
  }, [initial])

  const overall = useMemo(() => {
    const vals = Object.values(scores)
    if (!vals.length) return 0
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }, [scores])

  if (!canRate) {
    return (
      <div className="rating-panel rating-panel-locked">
        <h2>{t('books.rating.title')}</h2>
        <p>{t('books.rating.lockedHint')}</p>
      </div>
    )
  }

  return (
    <div className="rating-panel">
      <div className="rating-panel-head">
        <h2>{t('books.rating.title')}</h2>
        <div className="rating-overall">
          <strong>{overall}</strong>
          <span>{t('books.rating.outOf5')}</span>
        </div>
      </div>
      <p className="rating-panel-hint">{t('books.rating.hint')}</p>
      <ul className="rating-factor-list">
        {resolvedFactors.map((f) => (
          <li key={f.key} className="rating-factor-row">
            <span>{f.label}</span>
            <ScoreStars
              name={f.label}
              value={scores[f.key] || 0}
              onChange={(n) => setScores((prev) => ({ ...prev, [f.key]: n }))}
            />
          </li>
        ))}
      </ul>
      <div className="field">
        <label>{t('books.rating.reviewLabel')}</label>
        <textarea
          className="field-textarea"
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder={t('books.rating.reviewPlaceholder')}
        />
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => onSubmit({ ...scores, review })}
        >
          {rating ? t('books.rating.update') : t('books.rating.submit')}
        </button>
      </div>
    </div>
  )
}

export function RatingBadge({ score }) {
  const { t } = useTranslation()
  if (score == null) return null
  return (
    <span className="rating-badge" title={t('books.rating.badgeTitle')}>
      ★ {Number(score).toFixed(1)}
    </span>
  )
}
