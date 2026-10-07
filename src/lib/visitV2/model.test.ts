import { describe, it, expect } from 'vitest'
import {
  type V2Task, type V2Unit, type V2Session,
  taskProgress, lotProgress, unitProgress, buildTree, projectProgress,
  openSession, patchTask, addRemark, patchRemark, logementCounter, taskCounter,
  snapshotProgress, detectIssues, mergeSessions,
} from './model'

const leaf = (id: string, progress?: number, extra: Partial<V2Task> = {}): V2Task =>
  ({ id, title: id, lotId: 'L1', na: false, progress, ...extra })

const unit = (id: string, tasks: V2Task[], extra: Partial<V2Unit> = {}): V2Unit =>
  ({ id, label: id, buildingId: 'B', buildingLabel: 'Bâtiment A', tasks, ...extra })

const session = (units: V2Unit[], extra: Partial<V2Session> = {}): V2Session => ({
  id: 'S1', date: '2026-10-07', kindLabel: 'Visite', status: 'en_cours',
  startedAt: '2026-10-07T08:00:00Z', updatedAt: '2026-10-07T08:00:00Z',
  units, baseline: {}, remarks: [], acknowledged: [], ...extra,
})

describe('hiérarchie des moyennes', () => {
  it('chaque niveau est la moyenne du niveau inférieur', () => {
    const parent = leaf('P', undefined, { children: [leaf('s1', 50), leaf('s2', 0)] })
    const lotA = [parent, leaf('T2', 100)]
    expect(taskProgress(parent)).toBe(25)
    expect(lotProgress(lotA)).toBe(62.5)

    const u1 = unit('U1', [parent, leaf('T2', 100)])
    const u2 = unit('U2', [leaf('X', 0, { lotId: 'L2' })])
    expect(unitProgress(u1)).toBe(62.5)
    expect(unitProgress(u2)).toBe(0)

    const tree = buildTree([u1, u2])
    expect(tree).toHaveLength(1)
    expect(projectProgress([u1, u2])).toBeCloseTo(31.25)
  })

  it('exclut les lignes na de toute moyenne', () => {
    const u = unit('U', [leaf('a', 100), leaf('b', 0, { na: true })])
    expect(unitProgress(u)).toBe(100)
  })

  it('un niveau entièrement na sort du calcul parent', () => {
    const allNa = unit('U1', [leaf('a', 0, { na: true })])
    const real = unit('U2', [leaf('b', 80)])
    expect(unitProgress(allNa)).toBeNull()
    expect(projectProgress([allNa, real])).toBe(80)
  })

  it('le prévu ne sert jamais d avancement', () => {
    const u = unit('U', [leaf('a', undefined, { plannedProgress: 100 })])
    expect(unitProgress(u)).toBe(0)
  })

  it('regroupe les unités d une zone sous le bâtiment', () => {
    const u1 = unit('U1', [leaf('a', 100)], { groupLabel: 'Parties communes' })
    const u2 = unit('U2', [leaf('b', 0)], { groupLabel: 'Parties communes' })
    const u3 = unit('U3', [leaf('c', 50)])
    const [b] = buildTree([u1, u2, u3])
    expect(b.children.map(c => c.kind)).toEqual(['group', 'unit'])
  })
})

describe('compteurs figés', () => {
  it('première session : tout est compté', () => {
    const s = session([unit('U1', [leaf('a', 100), leaf('b', 0)])])
    expect(taskCounter(s)).toEqual({ remaining: 2, total: 2 })
    expect(logementCounter(s)).toEqual({ remaining: 1, total: 1 })
  })

  it('les terminés de la visite précédente sont exclus, sans bouger pendant la visite', () => {
    const previous = session([unit('U1', [leaf('a', 100), leaf('b', 50)])], { id: 'S0', status: 'close' })
    const baseline = snapshotProgress(previous.units)
    const current = session([unit('U1', [leaf('a', 100), leaf('b', 100)])], { baseline })
    // b était à 50 à l'ouverture : il reste compté même terminé maintenant
    expect(taskCounter(current)).toEqual({ remaining: 1, total: 2 })
  })

  it('une régression de 100 % réajoute la tâche au compteur', () => {
    const baseline = { 't:a': 100, 't:b': 100 }
    const s = session([unit('U1', [leaf('a', 60), leaf('b', 100)])], { baseline })
    expect(taskCounter(s)).toEqual({ remaining: 1, total: 2 })
  })

  it('patchTask met à jour la feuille ciblée', () => {
    const units = [unit('U1', [leaf('a', 0), leaf('b', 0)])]
    const next = patchTask(units, 'b', { progress: 70 })
    expect(next[0].tasks[1].progress).toBe(70)
    expect(next[0].tasks[0].progress).toBe(0)
  })
})

describe('remarques', () => {
  it('reporte les remarques ouvertes et pas les terminées', () => {
    const withOpen = addRemark(session([]), { description: 'ouvert', priority: 'haute', lotIds: ['L1'], unitIds: [], companies: [] }, 'T')
    const withDone = addRemark(withOpen, { description: 'fini', priority: 'basse', lotIds: ['L1'], unitIds: [], companies: [] }, 'T')
    const withFait = patchRemark(withDone, withDone.remarks[1].id, { status: 'fait' }, 'T')
    const closed = { ...withFait, status: 'close' as const }
    const next = openSession({
      id: 'S2', date: '2026-11-01', kindLabel: 'Visite', units: [], previous: closed, now: 'T2',
    })
    expect(next.remarks.map(r => r.description)).toEqual(['ouvert'])
    expect(next.remarks[0].createdIn).toBe('S1')
  })

  it('numérote les remarques dans l ordre', () => {
    const s = addRemark(session([]), { description: 'a', priority: 'moyenne', lotIds: [], unitIds: [], companies: [] }, 'T')
    expect(s.remarks[0].number).toBe(1)
  })
})

describe('incohérences', () => {
  it('signale une régression sans commentaire, pas une régression commentée', () => {
    const baseline = { 't:a': 100, 't:b': 100 }
    const s = session([unit('U1', [leaf('a', 40), leaf('b', 40, { comment: 'mur refait' })])], { baseline })
    const keys = detectIssues(s).map(i => i.key)
    expect(keys).toEqual(['t-regress:a'])
  })

  it('signale une remarque sans lot et une échéance dépassée', () => {
    const s = addRemark(session([]), { description: 'x', priority: 'basse', lotIds: [], unitIds: [], companies: [], dueDate: '2026-09-01' }, 'T')
    const keys = detectIssues(s).map(i => i.key)
    expect(keys.some(k => k.startsWith('r-nolot:'))).toBe(true)
    expect(keys.some(k => k.startsWith('r-late:'))).toBe(true)
  })

  it('les clés acceptées sont marquées', () => {
    const baseline = { 't:a': 100 }
    const s = session([unit('U1', [leaf('a', 10)])], { baseline, acknowledged: ['t-regress:a'] })
    expect(detectIssues(s)[0].acknowledged).toBe(true)
  })
})

describe('fusion local / distant', () => {
  it('garde la version la plus récente par identifiant', () => {
    const old = session([], { id: 'S1', updatedAt: '2026-10-07T08:00:00Z' })
    const recent = session([], { id: 'S1', updatedAt: '2026-10-07T09:00:00Z', kindLabel: 'Réunion' })
    const merged = mergeSessions([old], [recent])
    expect(merged).toHaveLength(1)
    expect(merged[0].kindLabel).toBe('Réunion')
  })
})
