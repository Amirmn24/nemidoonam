import { useEffect, useMemo, useRef, useState } from 'react'

const TYPE_META = {
  entries: { label: 'یادداشت', short: 'یادداشت' },
  challenges: { label: 'چالش', short: 'چالش' },
  reading: { label: 'مطالعه', short: 'مطالعه' },
}

const WEEKDAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] // Sat → Fri

const FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'entries', label: 'یادداشت' },
  { id: 'challenges', label: 'چالش' },
  { id: 'reading', label: 'مطالعه' },
]

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatFaDate(iso) {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(parseISO(iso))
  } catch {
    return iso
  }
}

function monthKey(iso) {
  return iso.slice(0, 7)
}

function monthLabel(iso) {
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(parseISO(iso))
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

function buildTooltip(day, date, filter) {
  const count = filteredCount(day, filter)
  const parts = []
  const b = day?.breakdown
  if (b) {
    if (b.entries) parts.push(`${b.entries} یادداشت`)
    if (b.challenges) parts.push(`${b.challenges} چالش`)
    if (b.reading) parts.push(`${b.reading} مطالعه`)
  }
  return {
    title: formatFaDate(date),
    line: count
      ? `${count} فعالیت${parts.length ? ` — ${parts.join(' · ')}` : ''}`
      : 'بدون فعالیت',
  }
}

export default function ActivityHeatmap({ heatmap, stats }) {
  const [filter, setFilter] = useState('all')
  const [hover, setHover] = useState(null)
  const scrollRef = useRef(null)

  const weeks = useMemo(() => buildWeeks(heatmap?.days || []), [heatmap])
  const monthLabels = useMemo(() => buildMonthLabels(weeks), [weeks])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // LTR grid: انتهای اسکرول = هفته‌های اخیر
    el.scrollLeft = el.scrollWidth
  }, [weeks])

  const tooltip = hover ? buildTooltip(hover.day, hover.date, filter) : null

  const selectCell = (cell) => {
    if (!cell.inRange) return
    setHover({ date: cell.date, day: cell.day })
  }

  return (
    <section className="dash-heatmap section" aria-label="نقشه فعالیت">
      <div className="dash-heatmap-head">
        <div className="section-head">
          <h2>نقشهٔ فعالیت</h2>
          <p>
            هر مربع یک روز است. Streak فعلی:{' '}
            <strong>{stats?.streak_current ?? 0}</strong> روز
            {stats?.streak_longest ? (
              <>
                {' '}
                · رکورد <strong>{stats.streak_longest}</strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="dash-heatmap-filters" role="tablist" aria-label="فیلتر نوع فعالیت">
          {FILTERS.map((item) => (
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
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={label} className={i % 2 === 0 ? 'is-visible' : ''}>
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
                          aria-label={`${cell.date}: ${count} فعالیت`}
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
            <span>کم</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`dash-heat-cell level-${level} is-legend`} />
            ))}
            <span>زیاد</span>
          </div>
          <div className="dash-heatmap-type-legend">
            {Object.entries(TYPE_META).map(([key, meta]) => (
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
              یک روز را لمس کن یا نشانگر را روی آن بگذار
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
