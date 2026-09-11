import { describe, expect, it } from 'vitest'
import {
  getReserves, getVisits, getLotsConfig, getGanttTasks, getLotProgress,
  getZoneRefs, getProjects, getCurrentProjectId, getUsers, getGanttPrefs,
} from './repo'

// In the node test environment there is no localStorage, so loadState falls back
// to the defaults. These tests lock in that a fresh install — and every newly
// created project — starts completely empty, and that only the pieces which are
// genuinely global (accounts, preferences) carry a built-in value.

describe('repo : un projet neuf démarre vide', () => {
  it('aucune réserve', () => {
    expect(getReserves()).toEqual([])
  })

  it('aucune visite ni réunion', () => {
    expect(getVisits()).toEqual([])
  })

  it('aucun lot configuré', () => {
    expect(getLotsConfig()).toEqual([])
  })

  it('aucune zone au catalogue', () => {
    expect(getZoneRefs()).toEqual([])
  })

  it('aucune tâche de planning, donc aucun avancement par lot', () => {
    expect(getGanttTasks()).toEqual([])
    expect(getLotProgress()).toEqual({})
  })
})

describe('repo : registre des projets', () => {
  it('démarre sans aucun projet', () => {
    expect(getProjects()).toEqual([])
  })

  it('ne désigne aucun projet actif tant qu’il n’en existe pas', () => {
    expect(getCurrentProjectId()).toBeNull()
  })
})

describe('repo : données globales conservées', () => {
  it('fournit les deux comptes de démarrage', () => {
    const users = getUsers()
    expect(users.map(u => u.username).sort()).toEqual(['superadmin', 'user'])
  })

  it('fournit les préférences de planning par défaut', () => {
    expect(getGanttPrefs()).toEqual({ zoom: 1, group: 'lot', autoSchedule: true })
  })
})
