import { GanttTask, TaskStatus } from '../types/gantt'

const today = new Date()
today.setHours(0, 0, 0, 0)
const addDays = (n: number) => new Date(today.getTime() + n * 86400000)

interface LeafSpec {
  logement: string
  zone: string
  label: string
  base: [number, number]      // baseline (contractual) offsets in days
  plan?: [number, number]     // planned offsets (defaults to base = no slip)
  progress: number
  status: TaskStatus
  critical?: boolean
  milestone?: boolean
  deps?: string[]
}

interface LotSpec {
  id: string
  lotId: string
  title: string
  responsible: string
  company: string
  progress: number
  status: TaskStatus
  critical: boolean
  deps: string[]
  /**
   * The real works making up the lot. Each LeafSpec below describes a logement;
   * it is expanded into one task per ouvrage, which is what gets ticked off
   * during a visite.
   */
  ouvrages: string[]
  leaves: LeafSpec[]
}

const LOTS: LotSpec[] = [
  {
    id: 'T-05-00', lotId: 'L05', title: 'LOT 05 - Menuiseries int. / Isolation',
    responsible: 'Jean Dupont', company: 'SMP', progress: 82, status: 'in-progress', critical: true, deps: [],
    ouvrages: ['Dépose menuiseries existantes', 'Pose blocs-portes', 'Isolation et calfeutrement'],
    leaves: [
      { logement: 'A-101', zone: 'BAT-A', label: 'Menuiseries A-101', base: [-15, -8], progress: 100, status: 'completed' },
      { logement: 'A-102', zone: 'BAT-A', label: 'Menuiseries A-102', base: [-8, 0], progress: 100, status: 'completed', deps: ['T-05-A101'] },
      { logement: 'B-201', zone: 'BAT-B', label: 'Menuiseries B-201', base: [0, 8], progress: 60, status: 'in-progress', critical: true, deps: ['T-05-A102'] },
      { logement: 'B-202', zone: 'BAT-B', label: 'Menuiseries B-202', base: [8, 18], progress: 0, status: 'not-started', deps: ['T-05-B201'] },
    ],
  },
  {
    id: 'T-06-00', lotId: 'L06', title: 'LOT 06 - Électricité / Contrôle accès',
    responsible: 'Marie Martin', company: 'ELEC', progress: 64, status: 'in-progress', critical: true, deps: [],
    ouvrages: ['Déplacement tableau divisionnaire', 'Visiophonie / contrôle d’accès', 'Appareillage et prises'],
    leaves: [
      { logement: 'A-101', zone: 'BAT-A', label: 'Électricité A-101', base: [-5, 4], progress: 100, status: 'completed' },
      { logement: 'A-102', zone: 'BAT-A', label: 'Électricité A-102', base: [4, 12], progress: 70, status: 'in-progress', critical: true, deps: ['T-06-A101'] },
      { logement: 'B-201', zone: 'BAT-B', label: 'Électricité B-201', base: [12, 22], progress: 20, status: 'in-progress', deps: ['T-06-A102'] },
      { logement: 'B-202', zone: 'BAT-B', label: 'Électricité B-202', base: [22, 32], progress: 0, status: 'not-started', deps: ['T-06-B201'] },
    ],
  },
  {
    id: 'T-07-00', lotId: 'L07', title: 'LOT 07 - CVC',
    responsible: 'Pierre Lécuyer', company: 'SOVECLIM', progress: 51, status: 'delayed', critical: true, deps: ['T-05-00', 'T-06-00'],
    ouvrages: ['Dépose des radiateurs', 'Pose des émetteurs', 'Raccordements et mise en service'],
    leaves: [
      { logement: 'A-101', zone: 'BAT-A', label: 'CVC A-101', base: [-20, -10], plan: [-20, -8], progress: 100, status: 'completed' },
      { logement: 'A-102', zone: 'BAT-A', label: 'CVC A-102', base: [-10, 2], plan: [-5, 9], progress: 40, status: 'delayed', critical: true, deps: ['T-07-A101'] },
      { logement: 'B-201', zone: 'BAT-B', label: 'CVC B-201', base: [2, 14], plan: [9, 21], progress: 0, status: 'blocked', deps: ['T-07-A102'] },
      { logement: 'B-202', zone: 'BAT-B', label: 'CVC B-202', base: [14, 24], plan: [21, 31], progress: 0, status: 'not-started', deps: ['T-07-B201'] },
    ],
  },
  {
    id: 'T-08-00', lotId: 'L08', title: 'LOT 08 - Embellissements',
    responsible: 'Anne Legrand', company: 'SORETHERM', progress: 32, status: 'in-progress', critical: false, deps: ['T-05-00', 'T-06-00'],
    ouvrages: ['Préparation des supports', 'Reprise des joints', 'Peinture deux couches'],
    leaves: [
      { logement: 'A-101', zone: 'BAT-A', label: 'Embellissements A-101', base: [10, 20], progress: 60, status: 'in-progress' },
      { logement: 'A-102', zone: 'BAT-A', label: 'Embellissements A-102', base: [20, 30], progress: 15, status: 'in-progress', deps: ['T-08-A101'] },
      { logement: 'B-201', zone: 'BAT-B', label: 'Embellissements B-201', base: [30, 38], progress: 0, status: 'not-started', deps: ['T-08-A102'] },
      { logement: 'B-202', zone: 'BAT-B', label: 'Embellissements B-202', base: [38, 45], progress: 0, status: 'not-started', deps: ['T-08-B201'] },
      { logement: 'COM', zone: 'COMMUNS', label: 'Jalon: Projet livré', base: [45, 45], progress: 0, status: 'not-started', milestone: true, critical: true, deps: ['T-08-B202'] },
    ],
  },
]

/**
 * Spread a logement's overall progress across its ouvrages, front-loaded: the
 * works are done in order, so 70 % over 3 ouvrages reads 100 / 100 / 10.
 */
function spreadProgress(total: number, count: number, index: number): number {
  return Math.max(0, Math.min(100, Math.round(total * count - index * 100)))
}

function statusFor(progress: number, logementStatus: TaskStatus): TaskStatus {
  if (progress >= 100) return 'completed'
  // the logement's own trouble (blocked / delayed) lands on the ouvrage in hand
  if (logementStatus === 'blocked' || logementStatus === 'delayed') return logementStatus
  return progress > 0 ? 'in-progress' : 'not-started'
}

function buildLot(spec: LotSpec): GanttTask {
  const prefix = `T-${spec.lotId.slice(1)}` // 'L05' -> 'T-05'
  const n = spec.ouvrages.length
  // A dependency written against a logement targets its LAST ouvrage.
  const resolveDep = (d: string) => (d.startsWith(prefix) && !d.endsWith('-00') ? `${d}-${n}` : d)

  const children: GanttTask[] = spec.leaves.flatMap(leaf => {
    const [bs, be] = leaf.base
    const [ps, pe] = leaf.plan ?? leaf.base
    const suffix = leaf.logement.replace('-', '')
    const baseId = `${prefix}-${suffix}`
    const deps = (leaf.deps ?? []).map(resolveDep)

    // A milestone has no ouvrages — it stays a single task.
    if (leaf.milestone) {
      return [{
        id: baseId, parent_id: spec.id, lot_id: spec.lotId, zone_id: leaf.zone, logement_id: leaf.logement,
        title: leaf.label,
        planned_start: addDays(ps), planned_end: addDays(pe), planned_duration: Math.max(0, pe - ps),
        baseline_start: addDays(bs), baseline_end: addDays(be),
        progress: leaf.progress, status: leaf.status,
        priority: leaf.critical ? 'critical' : 'medium', company_id: spec.company,
        dependencies: deps, is_milestone: true, is_critical: leaf.critical ?? false,
      } as GanttTask]
    }

    const planStep = (pe - ps) / n
    const baseStep = (be - bs) / n
    return spec.ouvrages.map((ouvrage, i) => {
      const progress = spreadProgress(leaf.progress, n, i)
      const s = ps + planStep * i
      const e = ps + planStep * (i + 1)
      return {
        id: `${baseId}-${i + 1}`,
        parent_id: spec.id,
        lot_id: spec.lotId,
        zone_id: leaf.zone,
        logement_id: leaf.logement,
        title: `${ouvrage} ${leaf.logement}`,
        planned_start: addDays(Math.round(s)),
        planned_end: addDays(Math.round(e)),
        planned_duration: Math.max(1, Math.round(planStep)),
        baseline_start: addDays(Math.round(bs + baseStep * i)),
        baseline_end: addDays(Math.round(bs + baseStep * (i + 1))),
        progress,
        status: statusFor(progress, leaf.status),
        priority: leaf.critical ? 'critical' : 'medium',
        company_id: spec.company,
        // first ouvrage inherits the logement's dependencies, the rest chain on
        dependencies: i === 0 ? deps : [`${baseId}-${i}`],
        is_milestone: false,
        is_critical: leaf.critical ?? false,
      } as GanttTask
    })
  })

  // Parent spans the union of its children's baseline/planned dates
  const minBase = Math.min(...children.map(c => (c.baseline_start ?? c.planned_start).getTime()))
  const maxBase = Math.max(...children.map(c => (c.baseline_end ?? c.planned_end).getTime()))
  const minPlan = Math.min(...children.map(c => c.planned_start.getTime()))
  const maxPlan = Math.max(...children.map(c => c.planned_end.getTime()))

  return {
    id: spec.id,
    lot_id: spec.lotId,
    title: spec.title,
    description: 'Ensemble du lot',
    planned_start: new Date(minPlan),
    planned_end: new Date(maxPlan),
    planned_duration: Math.round((maxPlan - minPlan) / 86400000),
    baseline_start: new Date(minBase),
    baseline_end: new Date(maxBase),
    progress: spec.progress,
    status: spec.status,
    priority: spec.critical ? 'critical' : 'high',
    responsible_user: spec.responsible,
    company_id: spec.company,
    dependencies: spec.deps,
    is_milestone: false,
    is_critical: spec.critical,
    children,
  }
}

export const GANTT_TASKS: GanttTask[] = LOTS.map(buildLot)
