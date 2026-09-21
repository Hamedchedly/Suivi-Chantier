// ────────────────────────────────────────────────────────────────────────────
// Opérations (projets).
//
// Un utilisateur peut suivre plusieurs chantiers. Chaque projet possède sa
// propre copie de TOUTES les données métier (planning, visites, réserves,
// finances…) : le cloisonnement est assuré par le repository, qui suffixe ses
// clés de stockage avec l'identifiant du projet actif (voir lib/repo.ts).
//
// Ce module ne connaît que le registre des projets : il ne touche à aucune
// donnée métier et n'effectue aucune entrée/sortie.
// ────────────────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  /** Référence interne de l'opération (ex. « ER.T2286 »). */
  reference?: string
  address?: string
  /** Intervenants de l'opération, tels qu'ils figurent en tête des comptes rendus. */
  moa?: string
  moe?: string
  amo?: string
  createdAt: string      // ISO
  /** Compte qui a créé le projet — informatif, pas un contrôle d'accès. */
  createdBy?: string
}

/** Opération mise à la corbeille : conservée (données intactes) et restaurable. */
export interface TrashedProject extends Project {
  deletedAt: string      // ISO
}

/** Champs texte facultatifs : une valeur vide efface le champ. */
const OPTIONAL_FIELDS = ['reference', 'address', 'moa', 'moe', 'amo'] as const

export type ProjectError = 'name_required' | 'name_taken' | 'not_found' | 'already_present'

export interface Result<T> {
  ok: boolean
  projects: T
  /** Projet concerné par l'opération, quand elle réussit. */
  project?: Project
  error?: ProjectError
}

export const PROJECT_ERROR_LABEL: Record<ProjectError, string> = {
  name_required: "Le nom de l'opération est obligatoire.",
  name_taken: 'Une opération porte déjà ce nom.',
  not_found: 'Opération introuvable.',
  already_present: 'Cette opération figure déjà dans le registre.',
}

export function findProject(projects: Project[], id: string | null | undefined): Project | undefined {
  if (!id) return undefined
  return projects.find(p => p.id === id)
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export interface ProjectInput {
  name: string
  reference?: string
  address?: string
  moa?: string
  moe?: string
  amo?: string
  createdBy?: string
}

export function createProject(projects: Project[], input: ProjectInput): Result<Project[]> {
  const name = input.name.trim()
  if (!name) return { ok: false, projects, error: 'name_required' }
  if (projects.some(p => sameName(p.name, name))) return { ok: false, projects, error: 'name_taken' }
  const project: Project = {
    id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  }
  for (const f of OPTIONAL_FIELDS) {
    const v = input[f]?.trim()
    if (v) project[f] = v
  }
  return { ok: true, projects: [...projects, project], project }
}

export function updateProject(
  projects: Project[], id: string, patch: Partial<ProjectInput>,
): Result<Project[]> {
  const current = findProject(projects, id)
  if (!current) return { ok: false, projects, error: 'not_found' }
  const name = patch.name === undefined ? current.name : patch.name.trim()
  if (!name) return { ok: false, projects, error: 'name_required' }
  if (projects.some(p => p.id !== id && sameName(p.name, name))) {
    return { ok: false, projects, error: 'name_taken' }
  }
  const next: Project = { ...current, name }
  for (const f of OPTIONAL_FIELDS) {
    if (patch[f] === undefined) continue          // champ non fourni : inchangé
    const v = patch[f]!.trim()
    if (v) next[f] = v; else delete next[f]       // fourni vide : effacé
  }
  return { ok: true, projects: projects.map(p => (p.id === id ? next : p)), project: next }
}

/**
 * Supprimer un projet retire aussi ses données : c'est au repository de purger
 * les clés correspondantes (deleteProjectData) après avoir appelé cette
 * fonction. Le dernier projet peut être supprimé — l'utilisateur se retrouve
 * alors sur un espace vide et doit en créer un.
 */
export function deleteProject(projects: Project[], id: string): Result<Project[]> {
  if (!findProject(projects, id)) return { ok: false, projects, error: 'not_found' }
  return { ok: true, projects: projects.filter(p => p.id !== id) }
}

/**
 * Projet à afficher : celui demandé s'il existe encore, sinon le premier de la
 * liste, sinon aucun. Évite de rester bloqué sur un projet supprimé.
 */
export function resolveCurrent(projects: Project[], currentId: string | null): string | null {
  if (findProject(projects, currentId)) return currentId
  return projects[0]?.id ?? null
}

/** Libellé court pour l'en-tête : « Réf — Nom » quand la référence existe. */
export function projectLabel(p: Project): string {
  return p.reference ? `${p.reference} — ${p.name}` : p.name
}

/** Sous-titre de l'en-tête : adresse si connue, sinon la référence. */
export function projectSubtitle(p: Project): string | undefined {
  if (p.address && p.reference) return `${p.reference} • ${p.address}`
  return p.address || p.reference || undefined
}

/**
 * Détection des projets orphelins : un identifiant référencé par au moins
 * une clé cloisonnée (`<base>::<projectId>`) mais absent du registre
 * `sc-projects-v1` a des données réelles quelque part sans plus être
 * visible dans « Mes opérations » (voir docs/AUDIT_ACACIAS_E2E_2026-09-21.md
 * §A). Fonction pure : ne lit ni n'écrit rien elle-même — repo.ts
 * (findOrphanProjects) lui fournit les clés réellement stockées.
 *
 * N'EST PAS une fonction de restauration : elle se contente de signaler.
 * Restaurer un projet orphelin sans en connaître l'origine reste une
 * décision humaine (voir la limite documentée dans le rapport d'audit).
 */
/** Ids de projet référencés par des clés cloisonnées (`<base>::<projectId>`). */
function scopedProjectIds(scopedStorageKeys: string[]): Set<string> {
  const ids = new Set<string>()
  for (const key of scopedStorageKeys) {
    const sep = key.lastIndexOf('::')
    if (sep === -1) continue
    const projectId = key.slice(sep + 2)
    if (projectId) ids.add(projectId)
  }
  return ids
}

export function findOrphanProjectIds(knownProjectIds: string[], scopedStorageKeys: string[]): string[] {
  const known = new Set(knownProjectIds)
  const withData = scopedProjectIds(scopedStorageKeys)
  return [...withData].filter(id => !known.has(id)).sort()
}

/**
 * Réinscrit dans le registre un projet dont les données métier cloisonnées
 * existent encore (sc-*::<id>) mais qui a disparu de sc-projects-v1 — le cas
 * documenté dans docs/AUDIT_ACACIAS_E2E_2026-09-21.md §A et
 * docs/SPRINT_FIABILISATION_2026-09-21.md §5.
 *
 * Contrairement à createProject, n'applique PAS la contrainte de nom unique :
 * plusieurs copies orphelines réelles et distinctes peuvent légitimement
 * porter le même nom (ex. deux copies indépendantes de « Gambetta » créées
 * par deux appareils avant ce correctif) — ce n'est pas à cette fonction de
 * les fusionner ou d'en choisir une. L'id fourni est réinscrit tel quel,
 * jamais régénéré. Aucun effet si l'id est déjà présent dans le registre
 * (jamais deux fois le même projet).
 */
export interface OrphanRestoreInput {
  id: string
  name: string
  reference?: string
  address?: string
  createdAt: string
}

export function restoreOrphanProject(projects: Project[], input: OrphanRestoreInput): Result<Project[]> {
  if (findProject(projects, input.id)) return { ok: false, projects, error: 'already_present' }
  const project: Project = { id: input.id, name: input.name, createdAt: input.createdAt }
  if (input.reference) project.reference = input.reference
  if (input.address) project.address = input.address
  return { ok: true, projects: [...projects, project], project }
}

/**
 * Diagnostic complet (lecture seule, aucun effet de bord) du registre face
 * aux données métier réellement présentes localement :
 *   • healthy — projet référencé ET avec au moins une donnée métier trouvée ;
 *   • registeredWithoutData — projet référencé mais sans aucune donnée
 *     métier retrouvée (projet neuf pas encore utilisé, ou données déjà
 *     purgées) ;
 *   • orphaned — données métier trouvées mais projet absent du registre
 *     (voir findOrphanProjectIds).
 * Ne transforme jamais ce constat en suppression ou en restauration
 * automatique : ce sont des fonctions séparées, appelées explicitement.
 */
export interface ProjectsDiagnosis {
  healthy: string[]
  registeredWithoutData: string[]
  orphaned: string[]
}

export function diagnoseProjectsRegistry(projects: Project[], scopedStorageKeys: string[]): ProjectsDiagnosis {
  const withData = scopedProjectIds(scopedStorageKeys)
  const registeredIds = new Set(projects.map(p => p.id))
  const healthy: string[] = []
  const registeredWithoutData: string[] = []
  for (const id of registeredIds) (withData.has(id) ? healthy : registeredWithoutData).push(id)
  const orphaned = [...withData].filter(id => !registeredIds.has(id)).sort()
  return { healthy: healthy.sort(), registeredWithoutData: registeredWithoutData.sort(), orphaned }
}
