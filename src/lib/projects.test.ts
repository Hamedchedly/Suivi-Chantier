import { describe, it, expect } from 'vitest'
import {
  Project, createProject, updateProject, deleteProject, findProject,
  resolveCurrent, projectLabel, projectSubtitle, findOrphanProjectIds,
  restoreOrphanProject, diagnoseProjectsRegistry,
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

describe('findOrphanProjectIds', () => {
  it('signale un id référencé par une clé cloisonnée mais absent du registre', () => {
    const keys = ['sc-gantt-v2::pKnown', 'sc-gantt-v2::pOrphan', 'sc-reserves-v1::pOrphan']
    expect(findOrphanProjectIds(['pKnown'], keys)).toEqual(['pOrphan'])
  })

  it('ne signale rien quand tous les ids référencés sont connus', () => {
    const keys = ['sc-gantt-v2::pA', 'sc-units-v1::pA', 'sc-gantt-v2::pB']
    expect(findOrphanProjectIds(['pA', 'pB'], keys)).toEqual([])
  })

  it('ignore les clés globales (sans "::") et ne les compte jamais comme orphelines', () => {
    const keys = ['sc-projects-v1', 'sc-trash-v1', 'sc-current-project-v1', 'sc-gantt-v2::pOrphan']
    expect(findOrphanProjectIds([], keys)).toEqual(['pOrphan'])
  })

  it('dédoublonne un même id orphelin référencé par plusieurs clés', () => {
    const keys = ['sc-gantt-v2::pOrphan', 'sc-units-v1::pOrphan', 'sc-reserves-v1::pOrphan']
    expect(findOrphanProjectIds([], keys)).toEqual(['pOrphan'])
  })

  it('reproduit le constat réel de l’audit Acacias : plusieurs ids orphelins simultanés', () => {
    const keys = [
      'sc-lots-config-v1::p1789340565817701', 'sc-lots-config-v1::p1789341672812846',
      'sc-lots-config-v1::p1789295288813528', 'sc-lots-config-v1::p-test-planning-20260919',
      'sc-lots-config-v1::p-demo-residence-20260920',
    ]
    expect(findOrphanProjectIds(['p-demo-residence-20260920'], keys)).toEqual([
      'p-test-planning-20260919', 'p1789295288813528', 'p1789340565817701', 'p1789341672812846',
    ])
  })
})

describe('restoreOrphanProject', () => {
  const input = (over: Partial<Parameters<typeof restoreOrphanProject>[1]> = {}) => ({
    id: 'p-orphan', name: '111 rue Gambetta', reference: 'ER.T2286',
    address: '111 Rue Gambetta, 51100 Reims', createdAt: '2026-09-17T21:31:17.590Z', ...over,
  })

  it('réinscrit le projet avec son id exact, sans toucher aux autres', () => {
    const r = restoreOrphanProject([base()], input())
    expect(r.ok).toBe(true)
    expect(r.projects.map(p => p.id)).toEqual(['p1', 'p-orphan'])
    expect(r.project).toEqual({
      id: 'p-orphan', name: '111 rue Gambetta', reference: 'ER.T2286',
      address: '111 Rue Gambetta, 51100 Reims', createdAt: '2026-09-17T21:31:17.590Z',
    })
  })

  it('n’effectue aucun effet si l’id est déjà présent dans le registre', () => {
    const already = [base({ id: 'p-orphan', name: 'Déjà là' })]
    const r = restoreOrphanProject(already, input())
    expect(r.ok).toBe(false)
    expect(r.error).toBe('already_present')
    expect(r.projects).toBe(already) // inchangé, même référence
  })

  it('autorise deux copies orphelines distinctes portant le même nom (cas réel Gambetta ×2)', () => {
    const afterFirst = restoreOrphanProject([], input({ id: 'gambetta-1' }))
    const afterSecond = restoreOrphanProject(afterFirst.projects, input({ id: 'gambetta-2' }))
    expect(afterSecond.ok).toBe(true)
    expect(afterSecond.projects.map(p => p.id).sort()).toEqual(['gambetta-1', 'gambetta-2'])
    expect(afterSecond.projects.every(p => p.name === '111 rue Gambetta')).toBe(true)
  })

  it('laisse les champs facultatifs absents plutôt que d’inventer une valeur', () => {
    const r = restoreOrphanProject([], input({ reference: undefined, address: undefined }))
    expect(r.project?.reference).toBeUndefined()
    expect(r.project?.address).toBeUndefined()
  })
})

describe('diagnoseProjectsRegistry', () => {
  it('classe un projet référencé avec données comme sain', () => {
    const d = diagnoseProjectsRegistry([base({ id: 'pA' })], ['sc-gantt-v2::pA'])
    expect(d).toEqual({ healthy: ['pA'], registeredWithoutData: [], orphaned: [] })
  })

  it('classe un projet référencé sans aucune donnée métier trouvée', () => {
    const d = diagnoseProjectsRegistry([base({ id: 'pNeuf' })], [])
    expect(d).toEqual({ healthy: [], registeredWithoutData: ['pNeuf'], orphaned: [] })
  })

  it('classe des données métier sans entrée de registre comme orphelines', () => {
    const d = diagnoseProjectsRegistry([], ['sc-units-v1::pOrphan'])
    expect(d).toEqual({ healthy: [], registeredWithoutData: [], orphaned: ['pOrphan'] })
  })

  it('reproduit le diagnostic réel post-restauration : Acacias + 5 restaurés sains, TEST-planning encore orphelin', () => {
    const projects = [
      base({ id: 'p-demo-residence-20260920', name: 'Acacias' }),
      base({ id: 'p1789340565817701', name: '111 rue Gambetta' }),
      base({ id: 'p1789341672812846', name: '111 rue Gambetta' }),
      base({ id: 'p1789295288813528', name: 'Résidence Les Tilleuls' }),
      base({ id: 'p1789325281482814', name: 'Résidence Les Tilleuls' }),
      base({ id: 'p1789483121506563', name: 'Résidence Les Tilleuls' }),
    ]
    const keys = [
      'sc-lots-config-v1::p-demo-residence-20260920',
      'sc-lots-config-v1::p1789340565817701', 'sc-lots-config-v1::p1789341672812846',
      'sc-lots-config-v1::p1789295288813528', 'sc-lots-config-v1::p1789325281482814',
      'sc-lots-config-v1::p1789483121506563',
      'sc-lots-config-v1::p-test-planning-20260919', // pas (encore) restauré
    ]
    const d = diagnoseProjectsRegistry(projects, keys)
    expect(d.healthy.sort()).toEqual(projects.map(p => p.id).sort())
    expect(d.registeredWithoutData).toEqual([])
    expect(d.orphaned).toEqual(['p-test-planning-20260919'])
  })
})
