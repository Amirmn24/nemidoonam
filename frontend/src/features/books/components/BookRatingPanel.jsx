import { useEffect, useMemo, useState } from 'react'

const DEFAULT_FACTORS = [
  { key: 'writing', label: 'نثر و زبان' },
  { key: 'content', label: 'محتوا و ایده' },
  { key: 'characters', label: 'شخصیت‌پردازی' },
  { key: 'pacing', label: 'ریتم روایت' },
  { key: 'impact', label: 'تأثیر عاطفی' },
]

function ScoreStars({ value, onChange, name }) {
  return (
    <div className="rating-stars" role="group" aria-label={name}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`rating-star${value >= n ? ' is-on' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} از ۵`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function BookRatingPanel({
  factors = DEFAULT_FACTORS,
  rating,
  canRate,
  busy,
  onSubmit,
}) {
  const initial = useMemo(() => {
    const scores = {}
    for (const f of factors) {
      const fromRating = rating?.factors?.find((x) => x.key === f.key)?.score
      scores[f.key] = fromRating || 3
    }
    return { scores, review: rating?.review || '' }
  }, [factors, rating])

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
        <h2>امتیاز کتاب</h2>
        <p>بعد از زدن تیک پایان می‌توانی به کتاب امتیاز بدهی.</p>
      </div>
    )
  }

  return (
    <div className="rating-panel">
      <div className="rating-panel-head">
        <h2>امتیاز کتاب</h2>
        <div className="rating-overall">
          <strong>{overall}</strong>
          <span>از ۵</span>
        </div>
      </div>
      <p className="rating-panel-hint">چند فاکتور را جداگانه بسنج؛ میانگین‌شان نمره کلی می‌شود.</p>
      <ul className="rating-factor-list">
        {factors.map((f) => (
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
        <label>یادداشت کوتاه (اختیاری)</label>
        <textarea
          className="field-textarea"
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="جمع‌بندی حس‌ات از کتاب…"
        />
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => onSubmit({ ...scores, review })}
        >
          {rating ? 'به‌روزرسانی امتیاز' : 'ثبت امتیاز'}
        </button>
      </div>
    </div>
  )
}

export function RatingBadge({ score }) {
  if (score == null) return null
  return (
    <span className="rating-badge" title="نمره کلی تو">
      ★ {Number(score).toFixed(1)}
    </span>
  )
}
