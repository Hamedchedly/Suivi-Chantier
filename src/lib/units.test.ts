import { describe, it, expect } from 'vitest'
import {
  Unit, TaskUnitLink, createUnit, renameUnit, deleteUnit, findUnit, childrenOf, roots,
  descendants, ancestors, unitPath, buildingOf, visitableUnits,
  isLinked, toggleLink, unitIdsForTask, taskIdsForUnit, taskConcernsUnit, pruneLinks,
} from './units'

const u = (id: string, kind: Unit['kind'], name: string, parentId?: string, sortOrder = 0): Unit =>
  ({ id, kind, name, parentId, sortOrder })

// Bâtiment A › R+1 › Logement 3, plus une partie commune et un extérieur.
const tree: Unit[] = [
  u('A', 'building', 'Bâtiment A'),
  u('A1', 'level', 'R+1', 'A'),
  u('L3', 'dwelling', 'Logement 3', 'A1'),
  u('C1', 'common', 'Hall', 'A', 1),
  u('EXT', 'exterior', 'Cour', undefined, 1),
]

describe('création', () => {
  it('refuse un nom vide', () => {
    expect(createUnit([], { name: '  ', kind: 'building' }).error).toBe('name_required')
  })

  it('crée un bâtiment à la racine', () => {
    const r = createUnit([], { name: ' Bâtiment B ', kind: 'building' })
    expect(r.ok).toBe(true)
    expect(r.unit?.name).toBe('Bâtiment B')
    expect(r.unit?.parentId).toBeUndefined()
  })

  it('refuse un logement à la racine', () => {
    expect(createUnit([], { name: 'Logt', kind: 'dwelling' }).error).toBe('kind_not_allowed')
  })

  it('refuse un bâtiment dans un bâtiment', () => {
    expect(createUnit(tree, { name: 'B', kind: 'building', parentId: 'A' }).error).toBe('kind_not_allowed')
  })

  it('accepte un logement directement sous un bâtiment', () => {
    expect(createUnit(tree, { name: 'Logt RDC', kind: 'dwelling', parentId: 'A' }).ok).toBe(true)
  })

  it('refuse un niveau sous un niveau', () => {
    expect(createUnit(tree, { name: 'R+2', kind: 'level', parentId: 'A1' }).error).toBe('kind_not_allowed')
  })

  it('refuse un doublon de nom au même endroit mais l’accepte ailleurs', () => {
    expect(createUnit(tree, { name: 'hall', kind: 'common', parentId: 'A' }).error).toBe('name_taken')
    expect(createUnit(tree, { name: 'Hall', kind: 'common', parentId: 'A1' }).ok).toBe(true)
  })

  it('signale un parent inconnu', () => {
    expect(createUnit(tree, { name: 'X', kind: 'dwelling', parentId: 'nope' }).error).toBe('not_found')
  })

  it('range la nouvelle unité après ses voisines', () => {
    const r = createUnit(tree, { name: 'Local vélos', kind: 'common', parentId: 'A' })
    expect(r.unit?.sortOrder).toBe(2)
  })
})

describe('arborescence', () => {
  it('liste les racines dans l’ordre', () => {
    expect(roots(tree).map(x => x.id)).toEqual(['A', 'EXT'])
  })

  it('liste les enfants directs', () => {
    expect(childrenOf(tree, 'A').map(x => x.id)).toEqual(['A1', 'C1'])
  })

  it('descend sur tous les niveaux', () => {
    expect(descendants(tree, 'A').map(x => x.id).sort()).toEqual(['A1', 'C1', 'L3'])
  })

  it('remonte la chaîne des ancêtres', () => {
    expect(ancestors(tree, 'L3').map(x => x.id)).toEqual(['A', 'A1'])
    expect(ancestors(tree, 'A')).toEqual([])
  })

  it('compose un chemin lisible', () => {
    expect(unitPath(tree, 'L3')).toBe('Bâtiment A › R+1 › Logement 3')
    expect(unitPath(tree, 'inconnu')).toBe('')
  })

  it('retrouve le bâtiment d’appartenance', () => {
    expect(buildingOf(tree, 'L3')?.id).toBe('A')
    expect(buildingOf(tree, 'A')?.id).toBe('A')
    expect(buildingOf(tree, 'EXT')?.id).toBe('EXT')
  })

  it('ne retient que les unités parcourables en visite', () => {
    expect(visitableUnits(tree).map(x => x.id).sort()).toEqual(['C1', 'EXT', 'L3'])
  })
})

describe('renommage et suppression', () => {
  it('renomme sans toucher au reste', () => {
    const r = renameUnit(tree, 'L3', { name: 'Logement 03', code: ' A-103 ' })
    expect(r.unit?.name).toBe('Logement 03')
    expect(r.unit?.code).toBe('A-103')
    expect(r.unit?.parentId).toBe('A1')
  })

  it('refuse un nom déjà pris chez le même parent', () => {
    expect(renameUnit(tree, 'C1', { name: 'R+1' }).error).toBe('name_taken')
  })

  it('supprime en cascade', () => {
    const r = deleteUnit(tree, 'A')
    expect(r.ok).toBe(true)
    expect(r.units.map(x => x.id)).toEqual(['EXT'])
  })

  it('signale une unité inconnue', () => {
    expect(deleteUnit(tree, 'nope').error).toBe('not_found')
    expect(findUnit(tree, 'nope')).toBeUndefined()
  })
})

describe('liens tâche ↔ unité', () => {
  const links: TaskUnitLink[] = [{ taskId: 'T1', unitId: 'L3' }, { taskId: 'T2', unitId: 'A' }]

  it('coche et décoche par le même geste', () => {
    expect(isLinked(links, 'T1', 'L3')).toBe(true)
    const off = toggleLink(links, 'T1', 'L3')
    expect(isLinked(off, 'T1', 'L3')).toBe(false)
    expect(isLinked(toggleLink(off, 'T1', 'L3'), 'T1', 'L3')).toBe(true)
  })

  it('lit la relation dans les deux sens', () => {
    expect(unitIdsForTask(links, 'T1')).toEqual(['L3'])
    expect(taskIdsForUnit(links, 'A')).toEqual(['T2'])
  })

  it('fait descendre un rattachement de bâtiment sur ses logements', () => {
    expect(taskConcernsUnit(tree, links, 'T2', 'L3')).toBe(true)   // T2 est lié au bâtiment A
    expect(taskConcernsUnit(tree, links, 'T1', 'L3')).toBe(true)   // T1 est lié au logement
    expect(taskConcernsUnit(tree, links, 'T1', 'C1')).toBe(false)
  })

  it('ne remonte pas : une tâche liée au logement ne concerne pas tout le bâtiment', () => {
    expect(taskConcernsUnit(tree, links, 'T1', 'A')).toBe(false)
  })

  it('purge les liens orphelins', () => {
    const pruned = pruneLinks(links, ['L3'], ['T1', 'T2'])
    expect(pruned).toEqual([{ taskId: 'T1', unitId: 'L3' }])
  })
})
