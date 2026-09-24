// @vitest-environment jsdom
// ────────────────────────────────────────────────────────────────────────────
// SPRINT PLANNING + JOURNAL CR — tests minimaux section 21, volet Journal CR :
// 9-12 (multi-entreprises/logements/lots, clôture N/N+1/N+2, bleu+gras),
// 16-17 (nommage fichier, config export persistante).
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import {
  Reserve, getReserveCompanies, getReserveLots, getReserveLocations,
  isAutoArchivedAt, isArchivedAt, isNewOrModifiedAt,
} from './reserves'
import { buildGroups } from '../components/pages/CrTable'
import { filenameFor } from '../components/pages/CrExport'
import { getCrExportConfig, saveCrExportConfig } from './repo'

const base = (over: Partial<Reserve> = {}): Reserve => ({
  id: 'r1', number: 'R-001', lotId: '', logementId: '', description: 'Point', priority: 'medium', status: 'open',
  createdAt: '2026-01-01T00:00:00Z', ...over,
})

describe('sprint 21.9 — remarque multi-entreprises (rétrocompatible)', () => {
  it('companyIds prioritaire sur company legacy quand présent', () => {
    const r = base({ company: 'SMP', companyIds: ['SMP', 'SOVECLIM'] })
    expect(getReserveCompanies(r)).toEqual(['SMP', 'SOVECLIM'])
  })
  it('retombe sur company legacy quand companyIds absent', () => {
    const r = base({ company: 'SMP' })
    expect(getReserveCompanies(r)).toEqual(['SMP'])
  })
})

describe('sprint 21.10 — « Toutes les entreprises »', () => {
  it('allCompanies vide la liste (même si companyIds est encore présent)', () => {
    const r = base({ allCompanies: true, companyIds: ['SMP'] })
    expect(getReserveCompanies(r)).toEqual([])
  })
})

describe('sprint 21.11 — remarque multi-logements', () => {
  it('logementIds prioritaire, retombe sur logementId legacy sinon', () => {
    expect(getReserveLocations(base({ logementIds: ['A-201', 'A-202'] }))).toEqual(['A-201', 'A-202'])
    expect(getReserveLocations(base({ logementId: 'A-101' }))).toEqual(['A-101'])
    expect(getReserveLocations(base())).toEqual([])
  })
})

describe('sprint 21.12 — remarque multi-lots affichée dans CHAQUE lot concerné (jamais dupliquée en base)', () => {
  it('buildGroups(par-lot) fait apparaître le même id de remarque sous LOT 03 et LOT 04', () => {
    const r = base({ id: 'multi', lotIds: ['L03', 'L04'] })
    const lots = [{ id: 'L03', name: 'LOT 03' }, { id: 'L04', name: 'LOT 04' }]
    const groups = buildGroups([r], 'par-lot', lots, [])
    expect(groups.map(g => g.key)).toEqual(['L03', 'L04'])
    expect(groups[0].rows[0].id).toBe('multi')
    expect(groups[1].rows[0].id).toBe('multi')
    // même objet, pas une copie distincte
    expect(groups[0].rows[0]).toBe(groups[1].rows[0])
  })

  it('getReserveLots reste rétrocompatible avec lotId seul', () => {
    expect(getReserveLots(base({ lotId: 'L06' }))).toEqual(['L06'])
  })
})

describe('sprint 21.13 — clôture au CR N : visible N/N+1/N+2, archivée à partir de N+3', () => {
  it('isAutoArchivedAt suit exactement la fenêtre de maintien', () => {
    const r = base({ closedCrNo: 10 })
    expect(isAutoArchivedAt(r, 10)).toBe(false)
    expect(isAutoArchivedAt(r, 11)).toBe(false)
    expect(isAutoArchivedAt(r, 12)).toBe(false)
    expect(isAutoArchivedAt(r, 13)).toBe(true)
  })
  it('sans closedCrNo (jamais clôturée), jamais archivée automatiquement', () => {
    expect(isAutoArchivedAt(base(), 999)).toBe(false)
  })
  it('isArchivedAt combine archivage manuel et automatique', () => {
    expect(isArchivedAt(base({ archived: true }), 1)).toBe(true)
    expect(isArchivedAt(base({ closedCrNo: 1 }), 4)).toBe(true)
    expect(isArchivedAt(base({ closedCrNo: 1 }), 3)).toBe(false)
  })
})

describe('sprint 21.14 — nouvelle remarque ou modification au CR courant = bleu + gras', () => {
  it('isNewOrModifiedAt vrai seulement au CR de création ou de dernière modification', () => {
    const created = base({ createdCrNo: 5 })
    expect(isNewOrModifiedAt(created, 5)).toBe(true)
    expect(isNewOrModifiedAt(created, 6)).toBe(false)
    const modified = base({ createdCrNo: 3, lastModifiedCrNo: 5 })
    expect(isNewOrModifiedAt(modified, 5)).toBe(true)
    expect(isNewOrModifiedAt(modified, 4)).toBe(false)
  })
  it('une ancienne remarque simplement encore ouverte ne devient jamais bleue', () => {
    expect(isNewOrModifiedAt(base({ createdCrNo: 1 }), 9)).toBe(false)
  })
})

describe('sprint 21.16 — configuration export PDF persistante par opération', () => {
  beforeEach(() => localStorage.clear())
  it('getCrExportConfig retombe sur un défaut complet (toutes sections activées)', () => {
    const cfg = getCrExportConfig()
    expect(cfg.order.length).toBe(9)
    expect(Object.values(cfg.sections).every(Boolean)).toBe(true)
  })
  it('un changement persiste et est relu tel quel', () => {
    const cfg = getCrExportConfig()
    const next = { ...cfg, sections: { ...cfg.sections, photos: false } }
    saveCrExportConfig(next)
    expect(getCrExportConfig().sections.photos).toBe(false)
  })
})

describe('sprint 21.17 — nom du fichier PDF au format YYMMDD - OPERATION_CR_NXX', () => {
  it('reproduit exactement le format des CR existants (ex. Gambetta)', () => {
    expect(filenameFor('GAMBETTA', 8, new Date(2026, 2, 17))).toBe('260317 - GAMBETTA_CR_N08')
  })
  it('normalise le nom d\'opération (espaces → _, majuscules)', () => {
    expect(filenameFor('les acacias', 2, new Date(2026, 8, 21))).toBe('260921 - LES_ACACIAS_CR_N02')
  })
})
