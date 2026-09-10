import { describe, expect, it } from 'vitest'
import { makeCalendar, isWorkingDay, nextWorkingDay, addWorkingDays, workingDaysBetween } from './calendar'

// 2026-09-07 est un lundi.
const mon = new Date(2026, 8, 7)
const sat = new Date(2026, 8, 12)
const sun = new Date(2026, 8, 13)
const day = (n: number) => { const d = new Date(mon); d.setDate(d.getDate() + n); return d }

describe('isWorkingDay', () => {
  const cal = makeCalendar()
  it('lundi est ouvré, samedi et dimanche non', () => {
    expect(isWorkingDay(mon, cal)).toBe(true)
    expect(isWorkingDay(sat, cal)).toBe(false)
    expect(isWorkingDay(sun, cal)).toBe(false)
  })
  it('exclut les congés (fin exclue)', () => {
    const c = makeCalendar([{ start: day(1), end: day(3) }]) // mardi + mercredi
    expect(isWorkingDay(day(1), c)).toBe(false)
    expect(isWorkingDay(day(2), c)).toBe(false)
    expect(isWorkingDay(day(3), c)).toBe(true)   // jeudi : fin exclue
  })
})

describe('nextWorkingDay', () => {
  const cal = makeCalendar()
  it('renvoie le jour même s’il est ouvré', () => {
    expect(nextWorkingDay(mon, cal).getDate()).toBe(mon.getDate())
  })
  it('saute le week-end', () => {
    const r = nextWorkingDay(sat, cal)
    expect(r.getDay()).toBe(1)                    // lundi
    expect(r.getDate()).toBe(14)
  })
  it('saute un congé qui suit le week-end', () => {
    const c = makeCalendar([{ start: day(7), end: day(8) }]) // lundi 14 en congé
    expect(nextWorkingDay(sat, c).getDate()).toBe(15)
  })
})

describe('addWorkingDays', () => {
  const cal = makeCalendar()
  it('avance en sautant le week-end', () => {
    // lundi + 5 jours ouvrés -> lundi suivant
    const r = addWorkingDays(mon, 5, cal)
    expect(r.getDay()).toBe(1)
    expect(r.getDate()).toBe(14)
  })
  it('n’avance pas pour 0', () => {
    expect(addWorkingDays(mon, 0, cal).getDate()).toBe(mon.getDate())
  })
})

describe('workingDaysBetween', () => {
  const cal = makeCalendar()
  it('compte une semaine pleine comme 5 jours ouvrés', () => {
    expect(workingDaysBetween(mon, day(7), cal)).toBe(5)
  })
  it('retourne 0 si la fin précède le début', () => {
    expect(workingDaysBetween(day(3), mon, cal)).toBe(0)
  })
})
