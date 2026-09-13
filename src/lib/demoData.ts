// ────────────────────────────────────────────────────────────────────────────
// Jeu d'exemple — projet FICTIF pour démonstration et présentation.
//
// Aucune donnée client réelle : opération inventée « Résidence Les Tilleuls ».
// Sert à remplir un projet en un clic (bouton « Charger un projet d'exemple »)
// pour montrer l'application non vide.
// ────────────────────────────────────────────────────────────────────────────

import type { GanttTask, TaskStatus } from '../types/gantt'
import type { Reserve } from './reserves'
import type { Marche, Avenant, Situation } from './finance'
import type { Unit, TaskUnitLink } from './units'
import type { LotContact, ProjectSeed, Holiday } from './repo'
import type { ProjectInput } from './projects'

export const DEMO_PROJECT: ProjectInput = {
  name: 'Résidence Les Tilleuls',
  reference: 'RT-2026',
  address: '8 Allée des Tilleuls, 51200 Épernay',
}

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

interface LeafSpec {
  id: string; title: string; s: [number, number, number]; e: [number, number, number]
  dur: number; progress: number; as?: [number, number, number]; ae?: [number, number, number]
}
const status = (p: number): TaskStatus => (p >= 100 ? 'completed' : p > 0 ? 'in-progress' : 'not-started')

function leaf(lotId: string, x: LeafSpec): GanttTask {
  return {
    id: x.id, parent_id: `LOT-${lotId}`, lot_id: lotId, title: x.title,
    planned_start: d(...x.s), planned_end: d(...x.e), planned_duration: x.dur,
    actual_start: x.as ? d(...x.as) : undefined,
    actual_end: x.ae ? d(...x.ae) : undefined,
    progress: x.progress, status: status(x.progress),
    priority: 'medium', dependencies: [], is_milestone: false, is_critical: false,
  }
}
function lot(lotId: string, title: string, leaves: GanttTask[]): GanttTask {
  const start = new Date(Math.min(...leaves.map(l => l.planned_start.getTime())))
  const end = new Date(Math.max(...leaves.map(l => l.planned_end.getTime())))
  const progress = Math.round(leaves.reduce((s, l) => s + l.progress, 0) / leaves.length)
  return {
    id: `LOT-${lotId}`, lot_id: lotId, title, planned_start: start, planned_end: end,
    planned_duration: 0, progress, status: 'in-progress', priority: 'medium',
    dependencies: [], is_milestone: false, is_critical: false, children: leaves,
  }
}

const gantt: GanttTask[] = [
  lot('LOT01', 'LOT 01 — Gros œuvre', [
    leaf('LOT01', { id: 'T-terr', title: 'Terrassement', s: [2026, 3, 2], e: [2026, 3, 13], dur: 10, progress: 100, as: [2026, 3, 2], ae: [2026, 3, 16] }),
    leaf('LOT01', { id: 'T-fond', title: 'Fondations', s: [2026, 3, 16], e: [2026, 4, 10], dur: 20, progress: 100, as: [2026, 3, 17], ae: [2026, 4, 14] }),
    leaf('LOT01', { id: 'T-elev', title: 'Élévation R+1', s: [2026, 4, 13], e: [2026, 5, 22], dur: 30, progress: 60, as: [2026, 4, 15] }),
  ]),
  lot('LOT03', 'LOT 03 — Menuiseries', [
    leaf('LOT03', { id: 'T-four', title: 'Fourniture menuiseries', s: [2026, 5, 4], e: [2026, 6, 12], dur: 30, progress: 100, as: [2026, 5, 6], ae: [2026, 6, 19] }),
    leaf('LOT03', { id: 'T-pose', title: 'Pose des menuiseries', s: [2026, 8, 17], e: [2026, 9, 11], dur: 20, progress: 40, as: [2026, 8, 24] }),
    leaf('LOT03', { id: 'T-vole', title: 'Volets roulants', s: [2026, 9, 14], e: [2026, 9, 25], dur: 10, progress: 0 }),
  ]),
  lot('LOT06', 'LOT 06 — Électricité', [
    leaf('LOT06', { id: 'T-gain', title: 'Passage des gaines', s: [2026, 7, 6], e: [2026, 8, 14], dur: 30, progress: 30, as: [2026, 7, 8] }),
    leaf('LOT06', { id: 'T-tabl', title: 'Pose des tableaux', s: [2026, 9, 1], e: [2026, 9, 19], dur: 15, progress: 0 }),
    leaf('LOT06', { id: 'T-appa', title: 'Appareillage & finitions', s: [2026, 9, 22], e: [2026, 10, 10], dur: 15, progress: 0 }),
  ]),
]

const units: Unit[] = [
  { id: 'u-A', kind: 'building', name: 'Bâtiment A', code: 'A', sortOrder: 0 },
  { id: 'u-A1', parentId: 'u-A', kind: 'level', name: 'R+1', sortOrder: 0 },
  { id: 'u-A11', parentId: 'u-A1', kind: 'dwelling', name: 'Logement A11', code: 'A-11', sortOrder: 0 },
  { id: 'u-A12', parentId: 'u-A1', kind: 'dwelling', name: 'Logement A12', code: 'A-12', sortOrder: 1 },
  { id: 'u-hallA', parentId: 'u-A', kind: 'common', name: 'Hall A', sortOrder: 2 },
  { id: 'u-B', kind: 'building', name: 'Bâtiment B', code: 'B', sortOrder: 1 },
  { id: 'u-B01', parentId: 'u-B', kind: 'dwelling', name: 'Logement B01', code: 'B-01', sortOrder: 0 },
]

const taskUnits: TaskUnitLink[] = [
  { taskId: 'T-fond', unitId: 'u-A' },
  { taskId: 'T-elev', unitId: 'u-A' },
  { taskId: 'T-pose', unitId: 'u-A11' },
  { taskId: 'T-pose', unitId: 'u-A12' },
  { taskId: 'T-gain', unitId: 'u-A' },
  { taskId: 'T-vole', unitId: 'u-B01' },
]

const lotsConfig: LotContact[] = [
  { id: 'LOT01', name: 'LOT 01 — Gros œuvre', company: 'Bâti-Construct', contactName: 'Marc Petit', email: 'm.petit@baticonstruct.fr', phone: '06 11 22 33 44' },
  { id: 'LOT03', name: 'LOT 03 — Menuiseries', company: 'Menuiserie du Vignoble', contactName: 'Julie Renard', email: 'j.renard@menuiserie-vignoble.fr', phone: '06 55 66 77 88' },
  { id: 'LOT06', name: 'LOT 06 — Électricité', company: 'ÉlecPro Champagne', contactName: 'Karim Baz', email: 'k.baz@elecpro-champagne.fr', phone: '06 99 88 77 66' },
]

const reserves: Reserve[] = [
  { id: 'r1', number: 'R-001', lotId: 'LOT06', logementId: 'u-A11', description: 'Prise manquante dans la cuisine, à ajouter au tableau divisionnaire.', priority: 'high', status: 'open', kind: 'action', dueDate: '2026-09-20', company: 'ÉlecPro Champagne', createdAt: '2026-09-08' },
  { id: 'r2', number: 'R-002', lotId: 'LOT03', logementId: 'u-A12', description: 'Jeu sur l’ouvrant de la fenêtre séjour, réglage à reprendre.', priority: 'medium', status: 'open', kind: 'observation', company: 'Menuiserie du Vignoble', createdAt: '2026-09-08' },
  { id: 'r3', number: 'R-003', lotId: 'LOT01', logementId: 'u-hallA', description: 'Éclat de peinture dans le hall, retouche à prévoir.', priority: 'low', status: 'resolved', kind: 'action', createdAt: '2026-08-22' },
]

const marches: Marche[] = [
  { id: 'm1', lotId: 'LOT01', company: 'Bâti-Construct', amountHT: 180000 },
  { id: 'm3', lotId: 'LOT03', company: 'Menuiserie du Vignoble', amountHT: 95000 },
  { id: 'm6', lotId: 'LOT06', company: 'ÉlecPro Champagne', amountHT: 72000 },
]
const avenants: Avenant[] = [
  { id: 'a1', marcheId: 'm1', label: 'Reprise de fondations (sol hétérogène)', amountHT: 12000, status: 'approved', date: '2026-04-20' },
]
const situations: Situation[] = [
  { id: 's1', marcheId: 'm1', number: 1, date: '2026-05-05', amountHT: 90000, status: 'paid' },
  { id: 's2', marcheId: 'm1', number: 2, date: '2026-07-05', amountHT: 60000, status: 'pending' },
  { id: 's3', marcheId: 'm3', number: 1, date: '2026-06-20', amountHT: 40000, status: 'paid' },
]
const holidays: Holiday[] = [
  { start: d(2026, 8, 3), end: d(2026, 8, 17), label: 'Congés d’été' },
]

/** Toutes les tranches du projet d'exemple, prêtes pour seedProjectData(). */
export function buildDemoSeed(): ProjectSeed {
  return { gantt, units, taskUnits, lotsConfig, reserves, marches, avenants, situations, holidays }
}
