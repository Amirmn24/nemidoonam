import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../../i18n/format'

const TYPE_KEYS = ['entries', 'challenges', 'reading']
const WEEKDAY_KEYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] // Sat → Fri
const FILTER_IDS = ['all', 'entries', 'challenges', 'reading']

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatHeatDate(iso) {
  try {
    return formatDate(parseISO(iso), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function monthKey(iso) {
  return iso.slice(0, 7)
}

function monthLabel(iso) {
  try {
    return formatDate(parseISO(iso), { month: 'short' })
  } catch {
    return iso.slice(5, 7)
  }
}

function filteredCount(day, filter) {
  if (!day) return 0
  if (filter === 'all') return day.count
  return day.breakdown?.[filter] || 0
}

function levelForCount(count) {
  if (count <= 0) return 0
  if (count < 3) return 1
  if (count < 5) return 2
  if (count < 8) return 3
  return 4
}

function dominantType(breakdown) {
  if (!breakdown) return null
  let best = null
  let bestCount = 0
  for (const [key, value] of Object.entries(breakdown)) {
    if (value > bestCount) {
      best = key
      bestCount = value
    }
  }
  return bestCount > 0 ? best : null
}

/** Build GitHub-style columns: each column is one week starting Saturday. */
function buildWeeks(days) {
  if (!days?.length) return []
  const byDate = new Map(days.map((d) => [d.date, d]))
  const start = parseISO(days[0].date)
  const end = parseISO(days[days.length - 1].date)

  const cursor = new Date(start)
  while (cursor.getDay() !== 6) cursor.setDate(cursor.getDate() - 1)

  const weeks = []
  while (cursor <= end) {
    const week = []
    for (let i = 0; i < 7; i += 1) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      const iso = `${y}-${m}-${d}`
      week.push({
        date: iso,
        inRange: Boolean(byDate.get(iso)),
        day: byDate.get(iso) || null,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function buildMonthLabels(weeks) {
  const labels = []
  let last = ''
  weeks.forEach((week, index) => {
    const firstInRange = week.find((cell) => cell.inRange)
    if (!firstInRange) {
      labels.push({ index, label: '' })
      return
    }
    const key = monthKey(firstInRange.date)
    if (key !== last) {
      labels.push({ index, label: monthLabel(firstInRange.date) })
      last = key
    } else {
      labels.push({ index, label: '' })
    }
  })
  return labels
}

function buildTooltip(day, date, filter, t) {
  const count = filteredCount(day, filter)
  const parts = []
  const b = day?.breakdown
  if (b) {
    if (b.entries) parts.push(t('dashboard.heatmap.partEntries', { count: b.entries }))
    if (b.challenges) parts.push(t('dashboard.heatmap.partChallenges', { count: b.challenges }))
    if (b.reading) parts.push(t('dashboard.heatmap.partReading', { count: b.reading }))
  }
  return {
    title: formatHeatDate(date),
    line: count
      ? parts.length
        ? t('dashboard.heatmap.activityWithParts', { count, parts: parts.join(' · ') })
        : t('dashboard.heatmap.activityCount', { count })
      : t('dashboard.heatmap.noActivity'),
  }
}

export default function ActivityHeatmap({ heatmap, stats }) {
  const { t, i18n } = useTranslation()
  const [filter, setFilter] = useState('all')
  const [hover, setHover] = useState(null)
  const scrollRef = useRef(null)

  const filters = useMemo(
    () => FILTER_IDS.map((id) => ({ id, label: t(`dashboard.heatmap.filters.${id}`) })),
    [t],
  )

  const weekdayLabels = useMemo(
    () => WEEKDAY_KEYS.map((key) => t(`dashboard.heatmap.weekdays.${key}`)),
    [t],
  )

  const typeMeta = useMemo(
    () =>
      Object.fromEntries(
        TYPE_KEYS.map((key) => [
          key,
          {
            label: t(`dashboard.heatmap.types.${key}`),
            short: t(`dashboard.heatmap.types.${key}`),
          },
        ]),
      ),
    [t],
  )

  const weeks = useMemo(() => buildWeeks(heatmap?.days || []), [heatmap])
  const monthLabels = useMemo(() => buildMonthLabels(weeks), [weeks, i18n.language])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // LTR grid: انتهای اسکرول = هفته‌های اخیر
    el.scrollLeft = el.scrollWidth
  }, [weeks])

  const tooltip = hover ? buildTooltip(hover.day, hover.date, filter, t) : null

  const selectCell = (cell) => {
    if (!cell.inRange) return
    setHover({ date: cell.date, day: cell.day })
  }

  return (
    <section className="dash-heatmap section" aria-label={t('dashboard.heatmap.aria')}>
      <div className="dash-heatmap-head">
        <div className="section-head">
          <h2>{t('dashboard.heatmap.title')}</h2>
          <p>
            {t('dashboard.heatmap.streakLine')}{' '}
            <strong>{stats?.streak_current ?? 0}</strong> {t('dashboard.heatmap.days')}
            {stats?.streak_longest ? (
              <>
                {' '}
                · {t('dashboard.heatmap.record')} <strong>{stats.streak_longest}</strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="dash-heatmap-filters" role="tablist" aria-label={t('dashboard.heatmap.filterAria')}>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`chip${filter === item.id ? ' is-active' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-heatmap-panel">
        <div className="dash-heatmap-scroll-x" ref={scrollRef}>
          <div className="dash-heatmap-body">
            <div className="dash-heatmap-weekdays" aria-hidden="true">
              <span className="dash-heatmap-weekday-spacer" />
              {weekdayLabels.map((label, i) => (
                <span key={WEEKDAY_KEYS[i]} className={i % 2 === 0 ? 'is-visible' : ''}>
                  {i % 2 === 0 ? label : ''}
                </span>
              ))}
            </div>

            <div className="dash-heatmap-canvas" dir="ltr">
              <div className="dash-heatmap-months" aria-hidden="true">
                {monthLabels.map((m) => (
                  <span key={`m-${m.index}`} className="dash-heatmap-month">
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="dash-heatmap-grid">
                {weeks.map((week, wi) => (
                  <div key={`w-${wi}`} className="dash-heatmap-week">
                    {week.map((cell) => {
                      const count = filteredCount(cell.day, filter)
                      const level = cell.inRange ? levelForCount(count) : -1
                      const dom =
                        filter === 'all' ? dominantType(cell.day?.breakdown) : filter
                      const typeClass = count > 0 && dom ? ` type-${dom}` : ''
                      const selected = hover?.date === cell.date
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          className={`dash-heat-cell level-${level}${typeClass}${
                            !cell.inRange ? ' is-out' : ''
                          }${selected ? ' is-selected' : ''}`}
                          disabled={!cell.inRange}
                          aria-label={t('dashboard.heatmap.cellAria', { date: cell.date, count })}
                          aria-pressed={selected}
                          onMouseEnter={() => selectCell(cell)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => selectCell(cell)}
                          onBlur={() => setHover(null)}
                          onClick={() => selectCell(cell)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="dash-heatmap-foot">
          <div className="dash-heatmap-legend" aria-hidden="true">
            <span>{t('dashboard.heatmap.low')}</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`dash-heat-cell level-${level} is-legend`} />
            ))}
            <span>{t('dashboard.heatmap.high')}</span>
          </div>
          <div className="dash-heatmap-type-legend">
            {Object.entries(typeMeta).map(([key, meta]) => (
              <span key={key} className={`dash-type-pill type-${key}`}>
                {meta.label}
              </span>
            ))}
          </div>
          {tooltip ? (
            <div className="dash-heatmap-tooltip" role="status">
              <strong>{tooltip.title}</strong>
              <span>{tooltip.line}</span>
            </div>
          ) : (
            <div className="dash-heatmap-tooltip is-placeholder">
              {t('dashboard.heatmap.placeholder')}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
