// ────────────────────────────────────────────────────────────────────────────
// ISO weeks.
//
// On site an entreprise commits to a WEEK ("fini en S38"), not to a calendar
// day. We store the week and derive the day the planning needs — the Friday,
// i.e. the last working day the promise still holds.
// ────────────────────────────────────────────────────────────────────────────

const MS_DAY = 86400000

const parseDay = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const fmtDay = (d: Date): string =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`

/** Monday of the ISO week containing `date` (ISO weeks start on Monday). */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const shift = (d.getDay() + 6) % 7 // Sunday(0) → 6, Monday(1) → 0
  d.setDate(d.getDate() - shift)
  return d
}

/** ISO week string ("2026-W38") for a yyyy-mm-dd date. */
export function dateToWeek(iso: string): string {
  const date = parseDay(iso)
  if (isNaN(date.getTime())) return ''
  // ISO: the week's Thursday decides which year and number the week belongs to.
  const thursday = mondayOf(date)
  thursday.setDate(thursday.getDate() + 3)
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const firstMonday = mondayOf(firstThursday)
  const week = Math.round((thursday.getTime() - firstMonday.getTime()) / (7 * MS_DAY)) + 1
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Monday of an ISO week string, as yyyy-mm-dd. */
export function weekToMonday(week: string): string | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(week)
  if (!m) return null
  const year = Number(m[1])
  const n = Number(m[2])
  if (n < 1 || n > 53) return null
  const firstMonday = mondayOf(new Date(year, 0, 4))
  const monday = new Date(firstMonday.getTime() + (n - 1) * 7 * MS_DAY)
  return fmtDay(monday)
}

/** Friday of an ISO week — the deadline a "fini en S38" promise really means. */
export function weekToFriday(week: string): string | null {
  const monday = weekToMonday(week)
  if (!monday) return null
  const d = parseDay(monday)
  d.setDate(d.getDate() + 4)
  return fmtDay(d)
}

/** "S38 · 14 → 18 sept." — how the commitment reads back to the user. */
export function weekLabel(week: string): string {
  const monday = weekToMonday(week)
  const friday = weekToFriday(week)
  if (!monday || !friday) return week
  const n = Number(/^\d{4}-W(\d{1,2})$/.exec(week)?.[1])
  const a = parseDay(monday), b = parseDay(friday)
  const month = (d: Date) => d.toLocaleDateString('fr', { month: 'short' })
  const span = a.getMonth() === b.getMonth()
    ? `${a.getDate()} → ${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} → ${b.getDate()} ${month(b)}`
  return `S${n} · ${span}`
}
