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
  leaves: LeafSpec[]
}

const LOTS: LotSpec[] = [
  {
    id: 'T-05-00', lotId: 'L05', title: 'LOT 05 - Menuiseries int. / Isolation',
    responsible: 'Jean Dupont', company: 'SMP', progress: 82, status: 'in-progress', critical: true, deps: [],
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
    leaves: [
      { logement: 'A-101', zone: 'BAT-A', label: 'Embellissements A-101', base: [10, 20], progress: 60, status: 'in-progress' },
      { logement: 'A-102', zone: 'BAT-A', label: 'Embellissements A-102', base: [20, 30], progress: 15, status: 'in-progress', deps: ['T-08-A101'] },
      { logement: 'B-201', zone: 'BAT-B', label: 'Embellissements B-201', base: [30, 38], progress: 0, status: 'not-started', deps: ['T-08-A102'] },
      { logement: 'B-202', zone: 'BAT-B', label: 'Embellissements B-202', base: [38, 45], progress: 0, status: 'not-started', deps: ['T-08-B201'] },
      { logement: 'COM', zone: 'COMMUNS', label: 'Jalon: Projet livré', base: [45, 45], progress: 0, status: 'not-started', milestone: true, critical: true, deps: ['T-08-B202'] },
    ],
  },
]

function buildLot(spec: LotSpec): GanttTask {
  const prefix = `T-${spec.lotId.slice(1)}` // 'L05' -> 'T-05'
  const children: GanttTask[] = spec.leaves.map(leaf => {
    const [bs, be] = leaf.base
    const [ps, pe] = leaf.plan ?? leaf.base
    const suffix = leaf.logement.replace('-', '')
    return {
      id: `${prefix}-${suffix}`,
      parent_id: spec.id,
      lot_id: spec.lotId,
      zone_id: leaf.zone,
      logement_id: leaf.logement,
      title: leaf.label,
      planned_start: addDays(ps),
      planned_end: addDays(pe),
      planned_duration: pe - ps,
      baseline_start: addDays(bs),
      baseline_end: addDays(be),
      progress: leaf.progress,
      status: leaf.status,
      priority: leaf.critical ? 'critical' : 'medium',
      company_id: spec.company,
      dependencies: leaf.deps ?? [],
      is_milestone: leaf.milestone ?? false,
      is_critical: leaf.critical ?? false,
    }
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
