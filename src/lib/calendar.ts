// Calendrier ouvré : week-ends + périodes de congés non travaillées.
// Fonctions pures, utilisées par l'auto-planification et l'affichage du Gantt.

export interface WorkCalendar {
  /** Jours de la semaine non travaillés (0 = dimanche … 6 = samedi). */
  weekend: number[]
  /** Périodes non travaillées : début inclus, fin exclue. */
  holidays: { start: Date; end: Date }[]
}

export const DEFAULT_WEEKEND = [0, 6] // dimanche + samedi

export function makeCalendar(holidays: { start: Date; end: Date }[] = [], weekend = DEFAULT_WEEKEND): WorkCalendar {
  return { weekend, holidays }
}

const atMidnight = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function isWorkingDay(d: Date, cal: WorkCalendar): boolean {
  const day = atMidnight(d)
  if (cal.weekend.includes(day.getDay())) return false
  const t = day.getTime()
  return !cal.holidays.some(h => t >= atMidnight(h.start).getTime() && t < atMidnight(h.end).getTime())
}

/** Première date ouvrée à partir de `d` (retourne `d` si déjà ouvrée). */
export function nextWorkingDay(d: Date, cal: WorkCalendar): Date {
  const x = atMidnight(d)
  let guard = 0
  while (!isWorkingDay(x, cal) && guard++ < 400) x.setDate(x.getDate() + 1)
  return x
}

/** Avance de `n` jours ouvrés à partir de `d`. */
export function addWorkingDays(d: Date, n: number, cal: WorkCalendar): Date {
  const x = atMidnight(d)
  let left = n
  let guard = 0
  while (left > 0 && guard++ < 4000) {
    x.setDate(x.getDate() + 1)
    if (isWorkingDay(x, cal)) left--
  }
  return x
}

/** Nombre de jours ouvrés dans [a, b) (0 si b <= a). */
export function workingDaysBetween(a: Date, b: Date, cal: WorkCalendar): number {
  const start = atMidnight(a)
  const end = atMidnight(b)
  let count = 0
  let guard = 0
  const cur = new Date(start)
  while (cur.getTime() < end.getTime() && guard++ < 4000) {
    if (isWorkingDay(cur, cal)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}
