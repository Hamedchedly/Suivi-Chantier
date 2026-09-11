import { describe, it, expect } from 'vitest'
import {
  Project, createProject, updateProject, deleteProject, findProject,
  resolveCurrent, projectLabel, projectSubtitle,
} from './projects'

const base = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'Gambetta', createdAt: '2026-09-01T08:00:00.000Z', ...over,
})

describe('createProject', () => {
  it('refuse un nom vide', () => {
    const r = createProject([], { name: '   ' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('name_required')
    expect(r.projects).toHaveLength(0)
  })

  it('refuse un nom déjà pris, sans tenir compte de la casse', () => {
    const r = createProject([base()], { name: '  gambetta ' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('name_taken')
  })

  it('crée le projet et le renvoie', () => {
    const r = createProject([], { name: ' Rue Gambetta ', reference: ' ER.T2286 ', address: ' Reims ' })
    expect(r.ok).toBe(true)
    expect(r.projects).toHaveLength(1)
    expect(r.project?.name).toBe('Rue Gambetta')
    expect(r.project?.reference).toBe('ER.T2286')
    expect(r.project?.address).toBe('Reims')
  })

  it('laisse vides les champs facultatifs non renseignés', () => {
    const r = createProject([], { name: 'Sans détail', reference: '   ' })
    expect(r.project?.reference).toBeUndefined()
    expect(r.project?.address).toBeUndefined()
  })

  it('donne des identifiants distincts', () => {
    const a = createProject([], { name: 'A' })
    const b = createProject(a.projects, { name: 'B' })
    expect(b.projects[0].id).not.toBe(b.projects[1].id)
  })
})

describe('updateProject', () => {
  it('signale un projet inconnu', () => {
    expect(updateProject([base()], 'nope', { name: 'X' }).error).toBe('not_found')
  })

  it('renomme sans toucher aux autres champs', () => {
    const r = updateProject([base({ address: 'Reims' })], 'p1', { name: 'Nouveau nom' })
    expect(r.ok).toBe(true)
    expect(r.project?.name).toBe('Nouveau nom')
    expect(r.project?.address).toBe('Reims')
  })

  it('refuse un nom déjà porté par un autre projet', () => {
    const list = [base(), base({ id: 'p2', name: 'Autre' })]
    expect(updateProject(list, 'p2', { name: 'Gambetta' }).error).toBe('name_taken')
  })

  it('accepte de réenregistrer son propre nom', () => {
    expect(updateProject([base()], 'p1', { name: 'Gambetta' }).ok).toBe(true)
  })

  it('efface un champ facultatif passé à vide', () => {
    const r = updateProject([base({ address: 'Reims' })], 'p1', { address: '  ' })
    expect(r.project?.address).toBeUndefined()
  })
})

describe('deleteProject', () => {
  it('retire le projet demandé', () => {
    const list = [base(), base({ id: 'p2', name: 'Autre' })]
    const r = deleteProject(list, 'p1')
    expect(r.ok).toBe(true)
    expect(r.projects.map(p => p.id)).toEqual(['p2'])
  })

  it('autorise la suppression du dernier projet', () => {
    const r = deleteProject([base()], 'p1')
    expect(r.ok).toBe(true)
    expect(r.projects).toHaveLength(0)
  })

  it('signale un projet inconnu', () => {
    expect(deleteProject([base()], 'nope').error).toBe('not_found')
  })
})

describe('resolveCurrent', () => {
  it('garde le projet courant quand il existe encore', () => {
    const list = [base(), base({ id: 'p2', name: 'Autre' })]
    expect(resolveCurrent(list, 'p2')).toBe('p2')
  })

  it('bascule sur le premier projet quand le courant a disparu', () => {
    expect(resolveCurrent([base({ id: 'p9', name: 'Reste' })], 'p1')).toBe('p9')
  })

  it('renvoie null quand il n’y a plus aucun projet', () => {
    expect(resolveCurrent([], 'p1')).toBeNull()
    expect(resolveCurrent([], null)).toBeNull()
  })
})

describe('libellés', () => {
  it('préfixe le nom par la référence quand elle existe', () => {
    expect(projectLabel(base({ reference: 'ER.T2286' }))).toBe('ER.T2286 — Gambetta')
    expect(projectLabel(base())).toBe('Gambetta')
  })

  it('compose le sous-titre selon les champs disponibles', () => {
    expect(projectSubtitle(base({ reference: 'ER.T2286', address: 'Reims' }))).toBe('ER.T2286 • Reims')
    expect(projectSubtitle(base({ address: 'Reims' }))).toBe('Reims')
    expect(projectSubtitle(base({ reference: 'ER.T2286' }))).toBe('ER.T2286')
    expect(projectSubtitle(base())).toBeUndefined()
  })
})

describe('findProject', () => {
  it('tolère un identifiant absent', () => {
    expect(findProject([base()], null)).toBeUndefined()
    expect(findProject([base()], undefined)).toBeUndefined()
    expect(findProject([base()], 'p1')?.name).toBe('Gambetta')
  })
})
