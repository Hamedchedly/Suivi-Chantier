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

/** Champs texte facultatifs : une valeur vide efface le champ. */
const OPTIONAL_FIELDS = ['reference', 'address', 'moa', 'moe', 'amo'] as const

export type ProjectError = 'name_required' | 'name_taken' | 'not_found'

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
