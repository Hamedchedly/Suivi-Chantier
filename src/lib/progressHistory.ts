// ────────────────────────────────────────────────────────────────────────────
// Historique d'avancement — chaque changement de progression est une entrée
// append-only, jamais un champ écrasé en place.
//
// Deux dates par entrée, jamais confondues :
//   · effective_date — la date à laquelle l'information est considérée vraie
//     sur le chantier ("une visite = une date de constat", rétroactive si besoin).
//   · created_at      — l'horodatage technique réel de la saisie dans l'appli.
//
// L'état courant (currentProgress) se retrouve TOUJOURS en rejouant l'historique
// trié par (effective_date, created_at) — jamais en lisant un champ "collant".
// Une correction rétroactive s'insère à sa vraie place chronologique et peut
// changer l'état courant sans jamais supprimer les entrées déjà enregistrées.
//
// Même convention de dates que DateCommitment/ChangeLogEntry/FollowUp : toutes
// les dates sont des string ISO, jamais des Date (voir storage.ts — un champ
// Date qui reçoit une string brute échappe au reviver {__date} et casse tout
// code qui appelle .getTime() dessus).
//
// Module pur : aucune entrée/sortie, persistance dans repo.ts.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'

export type HistorySource = 'visit' | 'manual' | 'calculated'

export interface ProgressHistoryEntry {
  id: string
  taskId: string
  effective_date: string    // ISO yyyy-mm-dd
  created_at: string        // ISO datetime
  old_progress: number      // audit/affichage seulement — jamais relu par la dérivation
  new_progress: number
  source: HistorySource
  visitId?: string
  visitDate?: string         // copie figée de visit.date au moment de l'écriture — jamais
                              // redéréférencée plus tard (visit.date reste éditable sans trace)
  user?: string
  note?: string
}

const byChronology = (a: ProgressHistoryEntry, b: ProgressHistoryEntry): number =>
  a.effective_date.localeCompare(b.effective_date) || a.created_at.localeCompare(b.created_at)

/** Historique d'UNE tâche, trié chronologiquement (effective_date, created_at en
 * tie-break). `history` doit déjà être filtré sur le taskId visé. */
export function sortedHistory(history: ProgressHistoryEntry[]): ProgressHistoryEntry[] {
  return [...history].sort(byChronology)
}

/** Avancement courant = dernière entrée par ordre chronologique. Fonction
 * identique pour une tâche feuille (entrées 'visit'/'manual') et une tâche
 * parente (ses propres entrées 'calculated') — seule la tranche d'historique
 * passée en argument diffère. */
export function currentProgress(history: ProgressHistoryEntry[], fallback = 0): number {
  const sorted = sortedHistory(history)
  return sorted.length ? sorted[sorted.length - 1].new_progress : fallback
}

/** Avancement juste avant qu'une nouvelle observation ne soit insérée à
 * (effective_date, created_at) — sert uniquement à renseigner old_progress
 * pour l'affichage/l'audit, jamais utilisé par currentProgress. */
export function progressJustBefore(history: ProgressHistoryEntry[], effective_date: string, created_at: string): number {
  const before = history.filter(h =>
    h.effective_date.localeCompare(effective_date) < 0 ||
    (h.effective_date === effective_date && h.created_at.localeCompare(created_at) < 0))
  return currentProgress(before, 0)
}

export interface AppendProgressInput {
  taskId: string
  effective_date: string
  new_progress: number
  source: HistorySource
  visitId?: string
  visitDate?: string
  user?: string
  note?: string
}

/**
 * Ajoute une observation à l'historique GLOBAL (toutes tâches confondues).
 * Jamais destructeur : une observation d'une visite DIFFÉRENTE (ou manuelle)
 * s'ajoute toujours ; seule une ré-écriture par LA MÊME visite pour LA MÊME
 * tâche remplace sa propre entrée précédente (id déterministe) — exactement
 * la même convention que DateCommitment/withoutVisit (rouvrir/re-clôturer une
 * visite corrige sa propre trace, jamais celle d'une visite antérieure).
 */
export function appendProgressEntry(history: ProgressHistoryEntry[], input: AppendProgressInput): ProgressHistoryEntry[] {
  const created_at = new Date().toISOString()
  const id = entryId(input.source, input.taskId, input.visitId, created_at)
  const taskHistory = history.filter(h => h.taskId === input.taskId)
  const entry: ProgressHistoryEntry = {
    id,
    taskId: input.taskId,
    effective_date: input.effective_date,
    created_at,
    old_progress: progressJustBefore(taskHistory, input.effective_date, created_at),
    new_progress: input.new_progress,
    source: input.source,
    visitId: input.visitId,
    visitDate: input.visitDate,
    user: input.user,
    note: input.note,
  }
  return [...history.filter(h => h.id !== id), entry]
}

function entryId(source: HistorySource, taskId: string, visitId: string | undefined, createdAt: string): string {
  if (source === 'visit' && visitId) return `ph-${visitId}-${taskId}`
  if (source === 'calculated' && visitId) return `ph-calc-${visitId}-${taskId}`
  return `ph-manual-${createdAt}-${Math.random().toString(36).slice(2, 8)}-${taskId}`
}

/**
 * Diffuse les entrées 'calculated' pour chaque tâche PARENTE dont l'avancement
 * recalculé (rollup pondéré) a changé entre `before` et `after` — nécessaire
 * pour que actual_start/actual_end d'un parent puissent être dérivés de son
 * propre historique, exactement comme pour une feuille (§3 du cahier des
 * charges : le début/fin réel d'un parent découle de son avancement calculé).
 * Pure — l'appelant persiste le résultat.
 */
export function deriveCalculatedEntries(
  before: GanttTask[],
  after: GanttTask[],
  trigger: { visitId?: string; visitDate?: string; effective_date: string; user?: string },
): ProgressHistoryEntry[] {
  const beforeById = new Map<string, GanttTask>()
  const indexTree = (list: GanttTask[]) => {
    for (const t of list) {
      beforeById.set(t.id, t)
      if (t.children?.length) indexTree(t.children)
    }
  }
  indexTree(before)

  const created_at = new Date().toISOString()
  const out: ProgressHistoryEntry[] = []
  const walk = (list: GanttTask[]) => {
    for (const t of list) {
      if (t.children?.length) {
        const prev = beforeById.get(t.id)
        if (!prev || prev.progress !== t.progress) {
          out.push({
            id: entryId('calculated', t.id, trigger.visitId, created_at),
            taskId: t.id,
            effective_date: trigger.effective_date,
            created_at,
            old_progress: prev?.progress ?? 0,
            new_progress: t.progress,
            source: 'calculated',
            visitId: trigger.visitId,
            visitDate: trigger.visitDate,
            user: trigger.user,
          })
        }
        walk(t.children)
      }
    }
  }
  walk(after)
  return out
}

/**
 * Pour une tâche SANS AUCUN historique (données existantes, avant historisation) :
 * synthétise une entrée "genèse" fidèle à ce qui est déjà stocké — jamais une
 * donnée inventée. created_at fixé à l'époque Unix pour garantir qu'elle est
 * toujours supplantée par la première vraie observation. Rejouer cette seule
 * entrée reproduit exactement progress/actual_start déjà stockés : la migration
 * est donc prouvée sans effet tant qu'aucune nouvelle observation n'est saisie.
 * null pour une tâche parente (son historique vient de son propre recompute,
 * jamais d'une genèse directe).
 */
export function genesisEntryFor(task: GanttTask): ProgressHistoryEntry | null {
  if (task.children?.length) return null
  const referenceDate = task.actual_start ?? task.planned_start
  return {
    id: `ph-genesis-${task.id}`,
    taskId: task.id,
    effective_date: isoDay(referenceDate),
    created_at: new Date(0).toISOString(),
    old_progress: 0,
    new_progress: task.progress,
    source: 'manual',
    note: 'Reprise automatique de la valeur existante (avant historisation).',
  }
}

/** Complète un historique chargé avec les entrées genèse manquantes — lecture
 * seule, ne force pas d'écriture ; l'appelant décide s'il persiste le résultat. */
export function withGenesisEntries(tasks: GanttTask[], history: ProgressHistoryEntry[]): ProgressHistoryEntry[] {
  const covered = new Set(history.map(h => h.taskId))
  const extra: ProgressHistoryEntry[] = []
  const walk = (list: GanttTask[]) => {
    for (const t of list) {
      if (!t.children?.length && !covered.has(t.id)) {
        const genesis = genesisEntryFor(t)
        if (genesis) extra.push(genesis)
      }
      if (t.children?.length) walk(t.children)
    }
  }
  walk(tasks)
  return extra.length ? [...history, ...extra] : history
}

/** Jour ISO en heure locale (pas .toISOString().slice(0,10), qui bascule en UTC
 * et peut décaler d'un jour selon le fuseau) — même précaution que isoDate dans
 * GanttDetails.tsx. */
export function isoDay(d: Date): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
