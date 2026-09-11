import { describe, expect, it } from 'vitest'
import { dateToWeek, weekToMonday, weekToFriday, weekLabel } from './weeks'

describe('dateToWeek', () => {
  it('numbers a mid-year week', () => {
    expect(dateToWeek('2026-09-16')).toBe('2026-W38')
  })
  it('is stable across every day of the same week', () => {
    // Monday 14 → Sunday 20 September 2026 all belong to W38
    for (const d of ['2026-09-14', '2026-09-16', '2026-09-20']) {
      expect(dateToWeek(d)).toBe('2026-W38')
    }
  })
  it('assigns early-January days to the week owning their Thursday', () => {
    // 1 Jan 2026 is a Thursday → week 1 of 2026
    expect(dateToWeek('2026-01-01')).toBe('2026-W01')
    // 1 Jan 2027 is a Friday → still week 53 of 2026
    expect(dateToWeek('2027-01-01')).toBe('2026-W53')
  })
})

describe('weekToMonday / weekToFriday', () => {
  it('resolves a week to its Monday and Friday', () => {
    expect(weekToMonday('2026-W38')).toBe('2026-09-14')
    expect(weekToFriday('2026-W38')).toBe('2026-09-18')
  })
  it('round-trips with dateToWeek', () => {
    const monday = weekToMonday('2026-W05')!
    expect(dateToWeek(monday)).toBe('2026-W05')
  })
  it('rejects malformed input', () => {
    expect(weekToMonday('nope')).toBeNull()
    expect(weekToMonday('2026-W00')).toBeNull()
    expect(weekToFriday('2026-W54')).toBeNull()
  })
})

describe('weekLabel', () => {
  it('reads back as a week number and its span', () => {
    expect(weekLabel('2026-W38')).toMatch(/^S38 · 14 → 18/)
  })
  it('spells both months when the week straddles them', () => {
    // W40 2026: Mon 28 Sep → Fri 2 Oct
    expect(weekLabel('2026-W40')).toMatch(/28.+→.+2/)
  })
  it('falls back to the raw value when unparseable', () => {
    expect(weekLabel('bogus')).toBe('bogus')
  })
})
