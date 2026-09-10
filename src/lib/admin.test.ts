import { describe, expect, it } from 'vitest'
import { nextRfiRef, countOpenRfis, countPendingVisas, fileSize, type Rfi, type Visa } from './admin'

const rfi = (ref: string, status: Rfi['status'] = 'open'): Rfi =>
  ({ id: ref, ref, subject: 's', lotId: 'L05', question: 'q', status, createdAt: '2026-09-01' })
const visa = (status: Visa['status']): Visa =>
  ({ id: Math.random().toString(), docName: 'd', index: 'A', lotId: 'L05', status, date: '2026-09-01' })

describe('nextRfiRef', () => {
  it('starts at DI-001', () => {
    expect(nextRfiRef([])).toBe('DI-001')
  })
  it('increments past the highest', () => {
    expect(nextRfiRef([rfi('DI-001'), rfi('DI-007'), rfi('DI-003')])).toBe('DI-008')
  })
})

describe('counts', () => {
  it('countOpenRfis counts open', () => {
    expect(countOpenRfis([rfi('DI-001', 'open'), rfi('DI-002', 'answered'), rfi('DI-003', 'open')])).toBe(2)
  })
  it('countPendingVisas counts pending', () => {
    expect(countPendingVisas([visa('pending'), visa('approved'), visa('pending'), visa('rejected')])).toBe(2)
  })
})

describe('fileSize', () => {
  it('shows Ko under 1 Mo', () => {
    expect(fileSize(512)).toBe('512 Ko')
  })
  it('shows Mo at/over 1024 Ko', () => {
    expect(fileSize(2048)).toBe('2.0 Mo')
  })
})
