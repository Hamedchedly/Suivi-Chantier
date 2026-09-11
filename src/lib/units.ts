// ────────────────────────────────────────────────────────────────────────────
// Structure de l'opération : bâtiments, niveaux, logements, communs, extérieurs.
//
// L'arbre est libre : un bâtiment peut contenir des niveaux, qui contiennent des
// logements, mais on peut aussi rattacher un logement directement au bâtiment.
// Chaque unité déclare CE QU'ELLE EST (`kind`), ce qui pilote les libellés et
// ce qui peut être parcouru en visite.
//
// Le rattachement des tâches de planning aux unités est une relation
// MULTIPLE des deux côtés : une tâche peut concerner plusieurs logements, et un
// logement est concerné par plusieurs tâches. On la saisit indifféremment depuis
// l'unité ou depuis la tâche — c'est la même liste de liens.
//
// Module pur : aucune entrée/sortie, tout est passé en argument.
// ────────────────────────────────────────────────────────────────────────────

export type UnitKind = 'building' | 'level' | 'dwelling' | 'common' | 'exterior'

export const UNIT_KINDS: UnitKind[] = ['building', 'level', 'dwelling', 'common', 'exterior']

export const UNIT_KIND_LABEL: Record<UnitKind, string> = {
  building: 'Bâtiment',
  level: 'Niveau',
  dwelling: 'Logement',
  common: 'Partie commune',
  exterior: 'Extérieur',
}

/** Ce qu'on peut créer sous une unité donnée (null = à la racine). */
export const ALLOWED_CHILDREN: Record<UnitKind | 'root', UnitKind[]> = {
  root: ['building', 'exterior'],
  building: ['level', 'dwelling', 'common'],
  level: ['dwelling', 'common'],
  dwelling: [],
  common: [],
  exterior: [],
}

export interface Unit {
  id: string
  parentId?: string
  kind: UnitKind
  name: string
  /** Code court affiché dans les listes (ex. « A-101 »). */
  code?: string
  sortOrder: number
}

export type UnitError = 'name_required' | 'not_found' | 'kind_not_allowed' | 'name_taken'

export const UNIT_ERROR_LABEL: Record<UnitError, string> = {
  name_required: 'Le nom est obligatoire.',
  not_found: 'Élément introuvable.',
  kind_not_allowed: "Ce type d'élément ne peut pas être placé ici.",
  name_taken: 'Un élément porte déjà ce nom au même endroit.',
}

export interface Result {
  ok: boolean
  units: Unit[]
  unit?: Unit
  error?: UnitError
}

export function findUnit(units: Unit[], id: string | null | undefined): Unit | undefined {
  if (!id) return undefined
  return units.find(u => u.id === id)
}

export function childrenOf(units: Unit[], parentId?: string): Unit[] {
  return units
    .filter(u => (u.parentId ?? undefined) === (parentId ?? undefined))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fr'))
}

/** Unités racines (bâtiments et extérieurs). */
export function roots(units: Unit[]): Unit[] {
  return childrenOf(units, undefined)
}

/** Tous les descendants d'une unité, elle exclue. */
export function descendants(units: Unit[], id: string): Unit[] {
  const out: Unit[] = []
  const walk = (parent: string) => {
    for (const c of childrenOf(units, parent)) { out.push(c); walk(c.id) }
  }
  walk(id)
  return out
}

/** Chaîne d'ancêtres, de la racine jusqu'au parent direct. */
export function ancestors(units: Unit[], id: string): Unit[] {
  const out: Unit[] = []
  let current = findUnit(units, id)
  const seen = new Set<string>([id])
  while (current?.parentId) {
    if (seen.has(current.parentId)) break        // garde-fou anti-boucle
    const parent = findUnit(units, current.parentId)
    if (!parent) break
    out.unshift(parent)
    seen.add(parent.id)
    current = parent
  }
  return out
}

/** « Bâtiment A › R+1 › Logement 3 » — pour situer une unité sans ambiguïté. */
export function unitPath(units: Unit[], id: string, sep = ' › '): string {
  const u = findUnit(units, id)
  if (!u) return ''
  return [...ancestors(units, id), u].map(x => x.name).join(sep)
}

/** Bâtiment (ou extérieur) auquel l'unité appartient — elle-même si c'en est un. */
export function buildingOf(units: Unit[], id: string): Unit | undefined {
  const u = findUnit(units, id)
  if (!u) return undefined
  if (!u.parentId) return u
  return ancestors(units, id)[0] ?? u
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export interface UnitInput {
  name: string
  kind: UnitKind
  code?: string
  parentId?: string
}

export function createUnit(units: Unit[], input: UnitInput): Result {
  const name = input.name.trim()
  if (!name) return { ok: false, units, error: 'name_required' }

  const parent = input.parentId ? findUnit(units, input.parentId) : undefined
  if (input.parentId && !parent) return { ok: false, units, error: 'not_found' }

  const allowed = ALLOWED_CHILDREN[parent ? parent.kind : 'root']
  if (!allowed.includes(input.kind)) return { ok: false, units, error: 'kind_not_allowed' }

  if (childrenOf(units, input.parentId).some(u => sameName(u.name, name))) {
    return { ok: false, units, error: 'name_taken' }
  }

  const siblings = childrenOf(units, input.parentId)
  const unit: Unit = {
    id: `u${Date.now()}${Math.floor(Math.random() * 1000)}`,
    parentId: input.parentId,
    kind: input.kind,
    name,
    code: input.code?.trim() || undefined,
    sortOrder: siblings.length ? Math.max(...siblings.map(s => s.sortOrder)) + 1 : 0,
  }
  return { ok: true, units: [...units, unit], unit }
}

export function renameUnit(units: Unit[], id: string, patch: { name?: string; code?: string }): Result {
  const current = findUnit(units, id)
  if (!current) return { ok: false, units, error: 'not_found' }
  const name = patch.name === undefined ? current.name : patch.name.trim()
  if (!name) return { ok: false, units, error: 'name_required' }
  if (childrenOf(units, current.parentId).some(u => u.id !== id && sameName(u.name, name))) {
    return { ok: false, units, error: 'name_taken' }
  }
  const next: Unit = {
    ...current,
    name,
    code: patch.code === undefined ? current.code : (patch.code.trim() || undefined),
  }
  return { ok: true, units: units.map(u => (u.id === id ? next : u)), unit: next }
}

/** Supprimer une unité supprime tout ce qu'elle contient. */
export function deleteUnit(units: Unit[], id: string): Result {
  if (!findUnit(units, id)) return { ok: false, units, error: 'not_found' }
  const doomed = new Set([id, ...descendants(units, id).map(u => u.id)])
  return { ok: true, units: units.filter(u => !doomed.has(u.id)) }
}

// ── Liens tâche ↔ unité ─────────────────────────────────────────────────────

export interface TaskUnitLink {
  taskId: string
  unitId: string
}

const sameLink = (a: TaskUnitLink, taskId: string, unitId: string) =>
  a.taskId === taskId && a.unitId === unitId

export function isLinked(links: TaskUnitLink[], taskId: string, unitId: string): boolean {
  return links.some(l => sameLink(l, taskId, unitId))
}

/** Coche/décoche — le même geste depuis l'unité ou depuis la tâche. */
export function toggleLink(links: TaskUnitLink[], taskId: string, unitId: string): TaskUnitLink[] {
  return isLinked(links, taskId, unitId)
    ? links.filter(l => !sameLink(l, taskId, unitId))
    : [...links, { taskId, unitId }]
}

export function unitIdsForTask(links: TaskUnitLink[], taskId: string): string[] {
  return links.filter(l => l.taskId === taskId).map(l => l.unitId)
}

export function taskIdsForUnit(links: TaskUnitLink[], unitId: string): string[] {
  return links.filter(l => l.unitId === unitId).map(l => l.taskId)
}

/**
 * Rattacher une tâche à un bâtiment vaut pour tout ce qu'il contient : on
 * remonte donc l'unité ET ses ancêtres pour savoir si une tâche la concerne.
 */
export function taskConcernsUnit(units: Unit[], links: TaskUnitLink[], taskId: string, unitId: string): boolean {
  if (isLinked(links, taskId, unitId)) return true
  return ancestors(units, unitId).some(a => isLinked(links, taskId, a.id))
}

/** Purge les liens dont l'unité ou la tâche n'existe plus. */
export function pruneLinks(links: TaskUnitLink[], unitIds: string[], taskIds: string[]): TaskUnitLink[] {
  const u = new Set(unitIds)
  const t = new Set(taskIds)
  return links.filter(l => u.has(l.unitId) && t.has(l.taskId))
}

/** Unités réellement parcourables en visite (tout sauf bâtiments et niveaux). */
export function visitableUnits(units: Unit[]): Unit[] {
  return units.filter(u => u.kind === 'dwelling' || u.kind === 'common' || u.kind === 'exterior')
}
