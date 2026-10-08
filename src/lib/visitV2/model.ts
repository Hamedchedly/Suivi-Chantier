// ────────────────────────────────────────────────────────────────────────────
// Visite v2 — modèle métier pur (aucune I/O).
//
// Hiérarchie : Projet › Bâtiment › Zone (optionnelle) › Logement › Lot › Tâche › Sous-tâche
// Règle unique : chaque niveau = moyenne (à poids égal) des niveaux inférieurs.
//   · les lignes « non applicable » (na) sont exclues de toute moyenne ;
//   · un niveau sans aucun élément applicable n'existe pas (null) et sort du calcul ;
//   · le prévu n'est JAMAIS utilisé comme avancement — il sert uniquement de repère.
//
// Compteurs « X/Y » : figés pendant une session. Ils se basent sur la photo de
// la session précédente close (`baseline`). Un élément déjà non terminé à
// l'ouverture reste compté ; un élément terminé à l'ouverture ne se rajoute
// que s'il régresse pendant la session.
// ────────────────────────────────────────────────────────────────────────────

import type { GanttTask } from '../../types/gantt'
import { recomputeAll } from '../planning'
import { deriveTaskStatus } from '../planningEngine'

export type RemarkPriority = 'basse' | 'moyenne' | 'haute'
export type RemarkStatus = 'a_faire' | 'en_cours' | 'retard' | 'fait' | 'obsolete'

export const REMARK_STATUS_LABEL: Record<RemarkStatus, string> = {
  a_faire: 'À faire', en_cours: 'En cours', retard: 'En retard', fait: 'Fait', obsolete: 'Obsolète',
}
export const REMARK_PRIORITY_LABEL: Record<RemarkPriority, string> = {
  basse: 'Basse', moyenne: 'Moyenne', haute: 'Haute',
}

export interface V2Task {
  id: string
  title: string
  lotId: string
  na: boolean
  progress?: number        // avancement observé ; undefined = non renseigné
  plannedProgress?: number // repère du planning, jamais utilisé dans un calcul
  comment?: string
  children?: V2Task[]
}

export interface V2Unit {
  id: string
  label: string
  buildingId: string
  buildingLabel: string
  groupLabel?: string      // zone regroupant plusieurs unités (communs, extérieur…)
  tasks: V2Task[]
}

export interface V2Remark {
  id: string
  number: number
  description: string
  priority: RemarkPriority
  status: RemarkStatus
  lotIds: string[]
  unitIds: string[]
  companies: string[]
  dueDate?: string
  createdIn: string        // id de la session où la remarque a été créée
  createdAt: string
  closedAt?: string
}

export interface V2Session {
  id: string
  date: string             // yyyy-mm-dd
  kindLabel: string
  status: 'en_cours' | 'close'
  startedAt: string
  updatedAt: string
  closedAt?: string
  units: V2Unit[]
  baseline: Record<string, number> // photo de la session précédente : `u:<id>` / `t:<id>` → %
  remarks: V2Remark[]
  acknowledged: string[]           // clés d'incohérences acceptées
}

// ── Moyennes ────────────────────────────────────────────────────────────────

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const present = (xs: (number | null)[]): number[] => xs.filter((x): x is number => x !== null)

/** Avancement d'une tâche : moyenne de ses sous-tâches, sinon son propre % observé. */
export function taskProgress(t: V2Task): number | null {
  if (t.children?.length) return mean(present(t.children.map(taskProgress)))
  if (t.na) return null
  return t.progress ?? 0
}

/** Lots d'une liste de tâches, dans l'ordre de première apparition. */
export function lotGroups(tasks: V2Task[]): { lotId: string; tasks: V2Task[] }[] {
  const out = new Map<string, V2Task[]>()
  for (const t of tasks) {
    const list = out.get(t.lotId)
    if (list) list.push(t)
    else out.set(t.lotId, [t])
  }
  return [...out].map(([lotId, list]) => ({ lotId, tasks: list }))
}

/** Avancement d'un lot : moyenne de ses tâches de premier niveau. */
export function lotProgress(tasks: V2Task[]): number | null {
  return mean(present(tasks.map(taskProgress)))
}

/** Avancement d'un logement / d'une unité : moyenne de ses lots. */
export function unitProgress(u: V2Unit): number | null {
  return mean(present(lotGroups(u.tasks).map(g => lotProgress(g.tasks))))
}

export type ChildNode = { kind: 'unit'; unit: V2Unit } | { kind: 'group'; label: string; units: V2Unit[] }
export interface BuildingNode { id: string; label: string; children: ChildNode[] }

/** Arbre Bâtiment › (Zone) › Logement, dérivé de la liste plate d'unités. */
export function buildTree(units: V2Unit[]): BuildingNode[] {
  const buildings = new Map<string, BuildingNode>()
  for (const u of units) {
    let b = buildings.get(u.buildingId)
    if (!b) {
      b = { id: u.buildingId, label: u.buildingLabel, children: [] }
      buildings.set(u.buildingId, b)
    }
    if (!u.groupLabel) {
      b.children.push({ kind: 'unit', unit: u })
      continue
    }
    let g = b.children.find((c): c is Extract<ChildNode, { kind: 'group' }> => c.kind === 'group' && c.label === u.groupLabel)
    if (!g) {
      g = { kind: 'group', label: u.groupLabel, units: [] }
      b.children.push(g)
    }
    g.units.push(u)
  }
  return [...buildings.values()]
}

export function nodeProgress(n: ChildNode): number | null {
  return n.kind === 'unit' ? unitProgress(n.unit) : mean(present(n.units.map(unitProgress)))
}

export function buildingProgress(b: BuildingNode): number | null {
  return mean(present(b.children.map(nodeProgress)))
}

/** Avancement du projet : moyenne de ses bâtiments. */
export function projectProgress(units: V2Unit[]): number | null {
  return mean(present(buildTree(units).map(buildingProgress)))
}

/** Un élément est « terminé » quand son % arrondi vaut 100. */
export const isComplete = (p: number | null): boolean => p !== null && Math.round(p) === 100

// ── Feuilles et compteurs figés ─────────────────────────────────────────────

export function leafTasks(tasks: V2Task[]): V2Task[] {
  return tasks.flatMap(t => (t.children?.length ? leafTasks(t.children) : [t]))
}

export function allLeaves(units: V2Unit[]): V2Task[] {
  return units.flatMap(u => leafTasks(u.tasks))
}

/**
 * Une tâche du planning peut concerner plusieurs logements : chaque occurrence
 * (logement × tâche) est une ligne indépendante, avec sa propre valeur observée.
 */
export interface LeafInstance { unitId: string; task: V2Task }

export function leafInstances(units: V2Unit[]): LeafInstance[] {
  return units.flatMap(u => leafTasks(u.tasks).map(task => ({ unitId: u.id, task })))
}

export interface Counter { remaining: number; total: number }

const unitKey = (id: string) => `u:${id}`
const taskKey = (unitId: string, taskId: string) => `t:${unitId}:${taskId}`

/** Un élément est compté tant qu'il n'était pas terminé à l'ouverture, ou qu'il régresse. */
export function isCounted(baseline: number | undefined, now: number): boolean {
  return baseline === undefined || Math.round(baseline) < 100 || Math.round(now) < 100
}

function counter(items: { key: string; now: number | null }[], baseline: Record<string, number>): Counter {
  const applicable = items.filter((i): i is { key: string; now: number } => i.now !== null)
  return {
    remaining: applicable.filter(i => isCounted(baseline[i.key], i.now)).length,
    total: applicable.length,
  }
}

/** « Logements X/Y » — unités encore à compter. */
export function logementCounter(s: V2Session): Counter {
  return counter(s.units.map(u => ({ key: unitKey(u.id), now: unitProgress(u) })), s.baseline)
}

/** « Tâches X/Y » — tâches feuilles encore à compter. */
export function taskCounter(s: V2Session): Counter {
  return counter(
    leafInstances(s.units).map(i => ({ key: taskKey(i.unitId, i.task.id), now: taskProgress(i.task) })),
    s.baseline,
  )
}

/** Photo des avancements (arrondis) servant de référence à la session suivante. */
export function snapshotProgress(units: V2Unit[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const u of units) {
    const p = unitProgress(u)
    if (p !== null) out[unitKey(u.id)] = Math.round(p)
  }
  for (const i of leafInstances(units)) {
    const p = taskProgress(i.task)
    if (p !== null) out[taskKey(i.unitId, i.task.id)] = Math.round(p)
  }
  return out
}

// ── Construction depuis le planning ─────────────────────────────────────────

export interface PlanningRef {
  refId: string
  label: string
  kind: string             // 'logement' | 'commun' | 'technique' | 'exterieur'
  buildingId: string
  buildingLabel: string
}

const GROUP_LABEL: Record<string, string> = {
  commun: 'Parties communes', technique: 'Technique', exterieur: 'Extérieur',
}

function plannedPct(t: GanttTask, today: Date): number | undefined {
  if (!t.planned_start || !t.planned_end) return undefined
  if (today <= t.planned_start) return 0
  const total = t.planned_end.getTime() - t.planned_start.getTime()
  const elapsed = today.getTime() - t.planned_start.getTime()
  return Math.min(100, Math.round((elapsed / total) * 100))
}

function toV2Task(t: GanttTask, today: Date): V2Task {
  return {
    id: t.id,
    title: t.title,
    lotId: t.lot_id,
    na: false,
    plannedProgress: plannedPct(t, today),
    children: t.children?.length ? t.children.map(c => toV2Task(c, today)) : undefined,
  }
}

/**
 * Unités de la session à partir du planning : chaque référence de zone reçoit
 * les tâches de travail (enfants directs des lots) qui la concernent.
 */
export function unitsFromPlanning(
  tasks: GanttTask[],
  refs: PlanningRef[],
  belongs: (t: GanttTask, refId: string) => boolean,
  today: Date = new Date(),
): V2Unit[] {
  const works = tasks.flatMap(lot => lot.children ?? [])
  return refs.map(ref => ({
    id: ref.refId,
    label: ref.label,
    buildingId: ref.buildingId,
    buildingLabel: ref.buildingLabel,
    groupLabel: ref.kind === 'logement' ? undefined : GROUP_LABEL[ref.kind] ?? ref.kind,
    tasks: works.filter(t => belongs(t, ref.refId)).map(t => toV2Task(t, today)),
  }))
}

// ── Cycle de session ────────────────────────────────────────────────────────

export function openSession(input: {
  id: string
  date: string
  kindLabel: string
  units: V2Unit[]
  previous?: V2Session           // dernière session close
  now: string
}): V2Session {
  const carried = (input.previous?.remarks ?? [])
    .filter(r => r.status !== 'fait' && r.status !== 'obsolete')
  return {
    id: input.id,
    date: input.date,
    kindLabel: input.kindLabel,
    status: 'en_cours',
    startedAt: input.now,
    updatedAt: input.now,
    units: input.units,
    baseline: input.previous ? snapshotProgress(input.previous.units) : {},
    remarks: carried,
    acknowledged: [],
  }
}

/** Modifie une tâche dans un seul logement : les autres occurrences du planning restent intactes. */
export function patchTask(
  units: V2Unit[], unitId: string, taskId: string, patch: Partial<Pick<V2Task, 'progress' | 'na' | 'comment'>>,
): V2Unit[] {
  const update = (list: V2Task[]): V2Task[] => list.map(t => {
    if (t.id === taskId) return { ...t, ...patch }
    return t.children?.length ? { ...t, children: update(t.children) } : t
  })
  return units.map(u => (u.id === unitId ? { ...u, tasks: update(u.tasks) } : u))
}

export function addRemark(
  s: V2Session,
  input: Pick<V2Remark, 'description' | 'priority' | 'lotIds' | 'unitIds' | 'companies' | 'dueDate'>,
  now: string,
): V2Session {
  const number = s.remarks.reduce((m, r) => Math.max(m, r.number), 0) + 1
  const remark: V2Remark = {
    id: `R${Date.now()}${number}`,
    number,
    status: 'a_faire',
    createdIn: s.id,
    createdAt: now,
    ...input,
  }
  return { ...s, remarks: [...s.remarks, remark] }
}

export function patchRemark(s: V2Session, remarkId: string, patch: Partial<V2Remark>, now: string): V2Session {
  return {
    ...s,
    remarks: s.remarks.map(r => {
      if (r.id !== remarkId) return r
      const next = { ...r, ...patch }
      if (patch.status === 'fait' && !r.closedAt) next.closedAt = now
      if (patch.status && patch.status !== 'fait') next.closedAt = undefined
      return next
    }),
  }
}

// ── Incohérences ────────────────────────────────────────────────────────────

export interface Issue {
  key: string
  severity: 'error' | 'warning'
  message: string
  taskId?: string
  remarkId?: string
}

/** Détecte les incohérences de la session. Les clés acceptées restent listées, marquées `acknowledged`. */
export function detectIssues(s: V2Session): (Issue & { acknowledged: boolean })[] {
  const issues: Issue[] = []
  for (const r of s.remarks) {
    if (r.status === 'obsolete') continue
    if (r.lotIds.length === 0) {
      issues.push({ key: `r-nolot:${r.id}`, severity: 'error', message: `Remarque ${r.number} : aucun lot rattaché`, remarkId: r.id })
    }
    if (r.dueDate && r.dueDate < s.date && r.status !== 'fait') {
      issues.push({ key: `r-late:${r.id}`, severity: 'warning', message: `Remarque ${r.number} : échéance ${r.dueDate} dépassée`, remarkId: r.id })
    }
  }
  for (const { unitId, task: t } of leafInstances(s.units)) {
    const base = s.baseline[taskKey(unitId, t.id)]
    const now = taskProgress(t)
    if (base !== undefined && Math.round(base) === 100 && now !== null && Math.round(now) < 100 && !t.comment?.trim()) {
      issues.push({
        key: `t-regress:${unitId}:${t.id}`, severity: 'warning',
        message: `${t.title} : régression de 100 % sans commentaire`, taskId: t.id,
      })
    }
  }
  return issues.map(i => ({ ...i, acknowledged: s.acknowledged.includes(i.key) }))
}

// ── Clôture : retour vers le planning ───────────────────────────────────────

/**
 * Applique les avancements observés aux feuilles du planning, puis remonte
 * les parents et lots via recomputeAll (pipeline unique de planning.ts).
 */
/**
 * Avancement observé par tâche du planning. Une tâche observée dans plusieurs
 * logements reçoit la moyenne de ses observations. Les N/A et les non renseignées sont ignorées.
 */
export function observedPlanningProgress(s: V2Session): Map<string, number> {
  const byTask = new Map<string, number[]>()
  for (const { task: t } of leafInstances(s.units)) {
    if (t.na || t.progress === undefined) continue
    const list = byTask.get(t.id) ?? []
    list.push(Math.max(0, Math.min(100, Math.round(t.progress))))
    byTask.set(t.id, list)
  }
  return new Map([...byTask].map(([id, vals]) => [id, Math.round(mean(vals) as number)]))
}

/** Applique les observations aux feuilles du planning, puis remonte parents et lots (pipeline recomputeAll). */
export function applySessionToPlanning(tasks: GanttTask[], s: V2Session): GanttTask[] {
  const observed = observedPlanningProgress(s)
  if (observed.size === 0) return tasks

  const applyLeaf = (t: GanttTask): GanttTask => {
    if (t.children?.length) return { ...t, children: t.children.map(applyLeaf) }
    const p = observed.get(t.id)
    if (p === undefined) return t
    return { ...t, progress: p, status: deriveTaskStatus(p, t.status) }
  }
  return recomputeAll(tasks.map(applyLeaf))
}

// ── Fusion local / distant ──────────────────────────────────────────────────

/** Par identifiant, la version la plus récemment modifiée l'emporte. */
export function mergeSessions(local: V2Session[], remote: V2Session[]): V2Session[] {
  const byId = new Map<string, V2Session>()
  for (const s of local) byId.set(s.id, s)
  for (const s of remote) {
    const current = byId.get(s.id)
    if (!current || s.updatedAt > current.updatedAt) byId.set(s.id, s)
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date))
}
