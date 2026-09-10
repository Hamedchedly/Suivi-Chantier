// CPM — Critical Path Method sur le réseau de tâches (dépendances fin → début).
// Fonctions pures : passe avant (au plus tôt), passe arrière (au plus tard),
// marge totale, chemin critique, et auto-planification (propagation des contraintes).

import { GanttTask } from '../types/gantt'

const DAY = 86400000

/** Numéro de jour absolu (minuit local) — sûr pour les différences. */
export function toDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return Math.round(x.getTime() / DAY)
}

/** Décale une date de n jours (sûr vis-à-vis des changements d'heure). */
export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() + n)
  return x
}

export interface CpmNode {
  id: string
  duration: number    // en jours
  es: number          // au plus tôt : début
  ef: number          // au plus tôt : fin
  ls: number          // au plus tard : début
  lf: number          // au plus tard : fin
  totalFloat: number  // marge totale (jours)
  critical: boolean
}

export interface CpmResult {
  nodes: Map<string, CpmNode>
  criticalIds: Set<string>
  hasCycle: boolean
  projectEnd: number
}

function collectLeaves(tasks: GanttTask[], acc: GanttTask[] = []): GanttTask[] {
  for (const t of tasks) {
    if (t.children?.length) collectLeaves(t.children, acc)
    else acc.push(t)
  }
  return acc
}

interface Graph {
  list: GanttTask[]
  byId: Map<string, GanttTask>
  preds: Map<string, string[]>
  succs: Map<string, string[]>
  order: string[]      // ordre topologique
  hasCycle: boolean
}

/** Construit le graphe des tâches feuilles + ordre topologique (Kahn). */
function buildGraph(tasks: GanttTask[]): Graph {
  const list = collectLeaves(tasks)
  const byId = new Map(list.map(t => [t.id, t]))
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const t of list) { preds.set(t.id, []); succs.set(t.id, []) }
  for (const t of list) {
    for (const p of t.dependencies ?? []) {
      if (!byId.has(p)) continue          // dépendance hors périmètre : ignorée
      preds.get(t.id)!.push(p)
      succs.get(p)!.push(t.id)
    }
  }

  const indeg = new Map<string, number>()
  for (const t of list) indeg.set(t.id, preds.get(t.id)!.length)
  const queue = list.filter(t => indeg.get(t.id) === 0).map(t => t.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of succs.get(id)!) {
      const n = indeg.get(s)! - 1
      indeg.set(s, n)
      if (n === 0) queue.push(s)
    }
  }
  return { list, byId, preds, succs, order, hasCycle: order.length !== list.length }
}

const durationOf = (t: GanttTask) => Math.max(0, toDay(t.planned_end) - toDay(t.planned_start))

/**
 * Calcule le CPM. Les tâches sans prédécesseur sont ancrées sur leur date
 * planifiée ; les autres au plus tôt après leurs prédécesseurs.
 * Marge totale = au plus tard − au plus tôt ; critique quand la marge est nulle.
 */
export function computeCpm(tasks: GanttTask[]): CpmResult {
  const g = buildGraph(tasks)
  if (g.hasCycle || g.list.length === 0) {
    return { nodes: new Map(), criticalIds: new Set(), hasCycle: g.hasCycle, projectEnd: 0 }
  }

  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  for (const id of g.order) {
    const t = g.byId.get(id)!
    const p = g.preds.get(id)!
    const start = p.length ? Math.max(...p.map(x => ef.get(x)!)) : toDay(t.planned_start)
    es.set(id, start)
    ef.set(id, start + durationOf(t))
  }
  const projectEnd = Math.max(...g.order.map(id => ef.get(id)!))

  const ls = new Map<string, number>()
  const lf = new Map<string, number>()
  for (let i = g.order.length - 1; i >= 0; i--) {
    const id = g.order[i]
    const t = g.byId.get(id)!
    const s = g.succs.get(id)!
    const finish = s.length ? Math.min(...s.map(x => ls.get(x)!)) : projectEnd
    lf.set(id, finish)
    ls.set(id, finish - durationOf(t))
  }

  const nodes = new Map<string, CpmNode>()
  const criticalIds = new Set<string>()
  for (const id of g.order) {
    const t = g.byId.get(id)!
    const totalFloat = ls.get(id)! - es.get(id)!
    const critical = totalFloat <= 0
    if (critical) criticalIds.add(id)
    nodes.set(id, {
      id, duration: durationOf(t),
      es: es.get(id)!, ef: ef.get(id)!, ls: ls.get(id)!, lf: lf.get(id)!,
      totalFloat, critical,
    })
  }
  return { nodes, criticalIds, hasCycle: false, projectEnd }
}

/**
 * Auto-planification : décale vers l'avant les successeurs qui violeraient
 * la contrainte fin → début. Ne ramène jamais une tâche en arrière (la marge
 * reste permise). Recalcule l'emprise des parents.
 */
export function autoSchedule(tasks: GanttTask[]): { tasks: GanttTask[]; shifted: string[] } {
  const g = buildGraph(tasks)
  if (g.hasCycle) return { tasks, shifted: [] }

  const dates = new Map<string, { start: Date; end: Date }>()
  for (const t of g.list) dates.set(t.id, { start: t.planned_start, end: t.planned_end })

  const shifted: string[] = []
  for (const id of g.order) {
    const p = g.preds.get(id)!
    if (!p.length) continue
    const cur = dates.get(id)!
    const required = Math.max(...p.map(x => toDay(dates.get(x)!.end)))
    const delta = required - toDay(cur.start)
    if (delta > 0) {
      dates.set(id, { start: addDays(cur.start, delta), end: addDays(cur.end, delta) })
      shifted.push(id)
    }
  }
  if (!shifted.length) return { tasks, shifted }

  const apply = (arr: GanttTask[]): GanttTask[] =>
    arr.map(t => {
      if (t.children?.length) {
        const children = apply(t.children)
        return {
          ...t, children,
          planned_start: new Date(Math.min(...children.map(c => c.planned_start.getTime()))),
          planned_end: new Date(Math.max(...children.map(c => c.planned_end.getTime()))),
        }
      }
      const nd = dates.get(t.id)
      if (!nd || (nd.start === t.planned_start && nd.end === t.planned_end)) return t
      return { ...t, planned_start: nd.start, planned_end: nd.end }
    })

  return { tasks: apply(tasks), shifted }
}

/** Applique le résultat CPM sur l'arbre : is_critical recalculé (parents inclus). */
export function applyCriticality(tasks: GanttTask[], criticalIds: Set<string>): GanttTask[] {
  return tasks.map(t => {
    if (t.children?.length) {
      const children = applyCriticality(t.children, criticalIds)
      return { ...t, children, is_critical: children.some(c => c.is_critical) }
    }
    return { ...t, is_critical: criticalIds.has(t.id) }
  })
}
