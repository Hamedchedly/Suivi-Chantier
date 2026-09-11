import { describe, it, expect } from 'vitest'
import {
  EMPTY_SELECTION, toggle, toggleAll, allSelected, prune, removeSelected, selectionLabel,
} from './selection'

const sel = (...ids: string[]) => new Set(ids)

describe('toggle', () => {
  it('ajoute puis retire un identifiant', () => {
    const one = toggle(EMPTY_SELECTION, 'a')
    expect([...one]).toEqual(['a'])
    expect([...toggle(one, 'a')]).toEqual([])
  })

  it('ne modifie pas la sélection d’origine', () => {
    const before = sel('a')
    toggle(before, 'b')
    expect([...before]).toEqual(['a'])
  })
})

describe('toggleAll', () => {
  it('coche tout quand rien n’est coché', () => {
    expect([...toggleAll(EMPTY_SELECTION, ['a', 'b'])].sort()).toEqual(['a', 'b'])
  })

  it('coche tout quand la sélection est partielle', () => {
    expect([...toggleAll(sel('a'), ['a', 'b'])].sort()).toEqual(['a', 'b'])
  })

  it('décoche tout quand tout est déjà coché', () => {
    expect([...toggleAll(sel('a', 'b'), ['a', 'b'])]).toEqual([])
  })

  it('ne touche pas aux éléments hors de la liste visible', () => {
    const next = toggleAll(sel('hors-filtre', 'a', 'b'), ['a', 'b'])
    expect([...next]).toEqual(['hors-filtre'])
  })

  it('ne fait rien sur une liste vide', () => {
    expect([...toggleAll(sel('a'), [])]).toEqual(['a'])
  })
})

describe('allSelected', () => {
  it('est faux sur une liste vide', () => {
    expect(allSelected(EMPTY_SELECTION, [])).toBe(false)
  })

  it('distingue sélection complète et partielle', () => {
    expect(allSelected(sel('a', 'b'), ['a', 'b'])).toBe(true)
    expect(allSelected(sel('a'), ['a', 'b'])).toBe(false)
  })
})

describe('prune', () => {
  it('oublie les identifiants disparus', () => {
    expect([...prune(sel('a', 'b', 'c'), ['a', 'c'])].sort()).toEqual(['a', 'c'])
  })
})

describe('removeSelected', () => {
  it('retire les éléments cochés en conservant l’ordre', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(removeSelected(items, sel('b')).map(i => i.id)).toEqual(['a', 'c'])
  })

  it('rend la liste inchangée quand rien n’est coché', () => {
    const items = [{ id: 'a' }]
    expect(removeSelected(items, EMPTY_SELECTION)).toEqual(items)
  })
})

describe('selectionLabel', () => {
  it('accorde en nombre', () => {
    expect(selectionLabel(0, 'visite', true)).toBe('0 visite sélectionnée')
    expect(selectionLabel(1, 'visite', true)).toBe('1 visite sélectionnée')
    expect(selectionLabel(3, 'visite', true)).toBe('3 visites sélectionnées')
  })

  it('accorde au masculin par défaut', () => {
    expect(selectionLabel(2, 'élément')).toBe('2 éléments sélectionnés')
  })
})
