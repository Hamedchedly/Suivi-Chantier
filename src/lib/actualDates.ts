// ────────────────────────────────────────────────────────────────────────────
// Dates réelles pilotées par l'historique d'avancement.
//
// Le modèle de dates ne comporte que DEUX repères :
//   • le PRÉVISIONNEL, qui est aussi le CONTRACTUEL (planned_start / planned_end).
//     Il est saisi par l'utilisateur et ne bouge que s'il le décide.
//   • le RÉEL (actual_start / actual_end), qui s'ajuste tout seul à l'avancement
//     constaté : il n'est jamais saisi à la main… sauf correction manuelle
//     explicite (voir ActualDateOverride ci-dessous), elle-même un événement
//     daté, jamais un simple écrasement de champ.
//
// Règles, sans rien inventer, mais désormais REJOUÉES depuis l'historique
// complet (jamais depuis la seule valeur courante — une correction rétroactive
// doit pouvoir déplacer actual_start/actual_end, pas seulement l'ajout le plus
// récent) :
//   0 %            → la tâche n'a pas démarré : aucune date réelle.
//   entre 1 et 99 %→ elle a démarré : on fige le début réel au PREMIER constat
//                    chronologique qui dépasse 0 %.
//   100 %          → elle est terminée : on fige la fin réelle au PREMIER
//                    constat chronologique qui atteint 100 %.
// Revenir en arrière (100 % → 60 %) rouvre la tâche : la fin réelle est effacée
// jusqu'au prochain passage à 100 % rencontré en rejouant l'historique — le
// début réel, lui, reste celui du tout premier franchissement de 0 %.
//
// Correction manuelle (GanttDetails.tsx) : coexiste avec la dérivation
// automatique via un événement séparé et horodaté (ActualDateOverride). Entre
// la dernière correction manuelle et la dernière observation d'historique
// pertinente, c'est l'information SAISIE LE PLUS RÉCEMMENT (comparaison sur
// `created_at`/`at`) qui l'emporte — jamais un écrasement inconditionnel d'un
// côté ni de l'autre. Aucune restriction de date future sur ce chemin manuel.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'
import { ProgressHistoryEntry, sortedHistory } from './progressHistory'

const startOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const parseIsoDay = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export type ActualDateField = 'actual_start' | 'actual_end'

/** Correction manuelle explicite d'une date réelle (GanttDetails.tsx) — un
 * événement horodaté, jamais une écriture directe du champ. `value: null` est
 * un effacement volontaire, lui aussi tracé (pas une simple absence). */
export interface ActualDateOverride {
  id: string
  taskId: string
  field: ActualDateField
  value: string | null // ISO yyyy-mm-dd
  at: string           // ISO datetime — autorité de comparaison face à l'historique
  user?: string
}

export interface ActualDateResult {
  actual_start?: Date
  actual_end?: Date
}

interface Candidate { date: string; at: string }

/**
 * Dates réelles d'UNE tâche, dérivées en rejouant tout son historique
 * chronologique (déjà filtré sur son taskId) + ses éventuelles corrections
 * manuelles. Fonction pure.
 */
export function deriveActualDates(history: ProgressHistoryEntry[], overrides: ActualDateOverride[]): ActualDateResult {
  const sorted = sortedHistory(history)

  let startCandidate: Candidate | undefined
  let endCandidate: Candidate | undefined
  for (const e of sorted) {
    if (!startCandidate && e.new_progress > 0) startCandidate = { date: e.effective_date, at: e.created_at }
    if (e.new_progress >= 100) {
      if (!endCandidate) endCandidate = { date: e.effective_date, at: e.created_at }
    } else {
      endCandidate = undefined // rouverte : effacée jusqu'au prochain passage à 100 rencontré
    }
  }

  const resolve = (field: ActualDateField, candidate?: Candidate): Date | undefined => {
    const relevant = overrides.filter(o => o.field === field)
    const lastOverride = relevant.length ? relevant.reduce((a, b) => (a.at > b.at ? a : b)) : undefined
    if (lastOverride && (!candidate || lastOverride.at > candidate.at)) {
      return lastOverride.value ? parseIsoDay(lastOverride.value) : undefined
    }
    return candidate ? parseIsoDay(candidate.date) : undefined
  }

  return { actual_start: resolve('actual_start', startCandidate), actual_end: resolve('actual_end', endCandidate) }
}

function withDerivedDates(task: GanttTask, actual_start?: Date, actual_end?: Date): GanttTask {
  return {
    ...task,
    actual_start,
    actual_end,
    actual_duration: actual_start && actual_end
      ? Math.max(1, Math.round((startOfDay(actual_end).getTime() - startOfDay(actual_start).getTime()) / 86400000) + 1)
      : undefined,
  }
}

/** Applique la dérivation à tout un arbre de tâches (feuilles ET parents — un
 * parent utilise sa propre tranche d'historique 'calculated', exactement le
 * même mécanisme qu'une feuille). */
export function applyDerivedActualDates(
  tasks: GanttTask[],
  allHistory: ProgressHistoryEntry[],
  allOverrides: ActualDateOverride[],
): GanttTask[] {
  const historyByTask = new Map<string, ProgressHistoryEntry[]>()
  for (const h of allHistory) {
    const arr = historyByTask.get(h.taskId) ?? []
    arr.push(h)
    historyByTask.set(h.taskId, arr)
  }
  const overridesByTask = new Map<string, ActualDateOverride[]>()
  for (const o of allOverrides) {
    const arr = overridesByTask.get(o.taskId) ?? []
    arr.push(o)
    overridesByTask.set(o.taskId, arr)
  }

  const walk = (list: GanttTask[]): GanttTask[] => list.map(t => {
    const { actual_start, actual_end } = deriveActualDates(
      historyByTask.get(t.id) ?? [], overridesByTask.get(t.id) ?? [],
    )
    const next = withDerivedDates(t, actual_start, actual_end)
    return t.children?.length ? { ...next, children: walk(t.children) } : next
  })
  return walk(tasks)
}

/**
 * Écart en jours entre le réel et le prévisionnel, sur la fin de tâche.
 * Positif = terminé (ou projeté) plus tard que prévu.
 * Renvoie null tant qu'aucune fin réelle n'est connue : on ne projette pas.
 */
export function endDrift(task: GanttTask): number | null {
  if (!task.actual_end) return null
  const ms = startOfDay(task.actual_end).getTime() - startOfDay(task.planned_end).getTime()
  return Math.round(ms / 86400000)
}

/** Écart en jours sur le démarrage — même convention. */
export function startDrift(task: GanttTask): number | null {
  if (!task.actual_start) return null
  const ms = startOfDay(task.actual_start).getTime() - startOfDay(task.planned_start).getTime()
  return Math.round(ms / 86400000)
}
