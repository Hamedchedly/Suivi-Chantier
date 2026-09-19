// ────────────────────────────────────────────────────────────────────────────
// Opération TEST — Validation Planning & Visite.
//
// Aucune donnée réelle de chantier : jeu de données synthétique, chargeable
// en un clic depuis « Mes opérations », dédié à la vérification du Gantt v2
// et du chaînage Visite → Planning SANS jamais toucher aux opérations
// réelles (notamment Gambetta — section « FINALISATION » du brief).
//
// Les dates sont calculées relativement à aujourd'hui (jamais figées) pour
// que le scénario E2E permanent (e2e/planning-visite.spec.ts) continue à
// exercer les bons cas — terminée, en cours dans les temps, en dépassement,
// bloquée, à venir — quel que soit le jour où il tourne.
// ────────────────────────────────────────────────────────────────────────────

import type { GanttTask, TaskStatus } from '../types/gantt'
import type { LotContact, ProjectSeed } from './repo'
import type { ProjectInput } from './projects'
import type { Unit, TaskUnitLink } from './units'

export const TEST_PROJECT: ProjectInput = {
  name: 'TEST — Validation Planning & Visite',
  reference: 'TEST-E2E',
  address: 'Opération de test — aucune donnée réelle',
}

const DAY = 86400000
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
/** Décale d'un nombre de jours (négatif = passé) depuis aujourd'hui minuit. */
const rel = (offsetDays: number): Date => new Date(today0().getTime() + offsetDays * DAY)

const status = (p: number, override?: TaskStatus): TaskStatus =>
  override ?? (p >= 100 ? 'completed' : p > 0 ? 'in-progress' : 'not-started')

interface LeafSpec {
  id: string; title: string; startOffset: number; endOffset: number
  progress: number; statusOverride?: TaskStatus
  actualStartOffset?: number; actualEndOffset?: number
  forecastEndOffset?: number
  isMilestone?: boolean
  dependencies?: string[]
  logementId?: string
}

function leaf(lotId: string, x: LeafSpec): GanttTask {
  const start = rel(x.startOffset)
  const end = rel(x.endOffset)
  return {
    id: x.id, parent_id: `LOT-${lotId}`, lot_id: lotId, title: x.title,
    logement_id: x.logementId,
    planned_start: start, planned_end: end, planned_duration: Math.max(1, x.endOffset - x.startOffset + 1),
    actual_start: x.actualStartOffset !== undefined ? rel(x.actualStartOffset) : undefined,
    actual_end: x.actualEndOffset !== undefined ? rel(x.actualEndOffset) : undefined,
    forecast_start: x.forecastEndOffset !== undefined ? start : undefined,
    forecast_end: x.forecastEndOffset !== undefined ? rel(x.forecastEndOffset) : undefined,
    forecast_method: x.forecastEndOffset !== undefined ? 'manual' : undefined,
    progress: x.progress, status: status(x.progress, x.statusOverride),
    priority: 'medium', dependencies: x.dependencies ?? [],
    is_milestone: !!x.isMilestone, is_critical: false,
  }
}

function lot(lotId: string, title: string, leaves: GanttTask[]): GanttTask {
  const start = new Date(Math.min(...leaves.map(l => l.planned_start.getTime())))
  const end = new Date(Math.max(...leaves.map(l => l.planned_end.getTime())))
  const work = leaves.filter(l => !l.is_milestone)
  const progress = work.length ? Math.round(work.reduce((s, l) => s + l.progress, 0) / work.length) : 0
  return {
    id: `LOT-${lotId}`, lot_id: lotId, title, planned_start: start, planned_end: end,
    planned_duration: 0, progress, status: status(progress), priority: 'medium',
    dependencies: [], is_milestone: false, is_critical: false, children: leaves,
  }
}

/**
 * Couvre volontairement chaque règle de couleur du Gantt v2 :
 * - T-TERR-OK : terminée (100 %) → verte.
 * - T-TERR-RETARD : dépassement contractuel, non terminée → rouge immédiat.
 * - T-GO-COURS : en cours, dans les temps → dégradé bleu→vert.
 * - T-GO-BLOQ : bloquée → rouge hachuré, quel que soit l'avancement.
 * - T-GO-AVENIR : pas encore démarrée, échéance future → pas de rouge.
 * - T-GO-JALON : jalon (is_milestone) — exclu des moyennes de progression.
 * - T-MENU-A101 / T-MENU-B01 : deux logements distincts (vue « Par logement »)
 *   + une dépendance FS sur T-GO-COURS + une prévision qui diverge du
 *   contractuel (couche « Prévision » visible).
 */
const gantt: GanttTask[] = [
  lot('LOT01', 'LOT 01 — Terrassement', [
    leaf('LOT01', { id: 'T-TERR-OK', title: 'Terrassement complet', startOffset: -30, endOffset: -20, progress: 100, actualStartOffset: -30, actualEndOffset: -21 }),
    leaf('LOT01', { id: 'T-TERR-RETARD', title: 'Réception terrassement', startOffset: -19, endOffset: -15, progress: 40, actualStartOffset: -18 }),
  ]),
  lot('LOT02', 'LOT 02 — Gros œuvre', [
    leaf('LOT02', { id: 'T-GO-COURS', title: 'Fondations', startOffset: -10, endOffset: 5, progress: 50, actualStartOffset: -9 }),
    leaf('LOT02', { id: 'T-GO-BLOQ', title: 'Élévation R+1', startOffset: -2, endOffset: 8, progress: 20, actualStartOffset: -2, statusOverride: 'blocked' }),
    leaf('LOT02', { id: 'T-GO-AVENIR', title: 'Dalle R+2', startOffset: 5, endOffset: 15, progress: 0 }),
    leaf('LOT02', { id: 'T-GO-JALON', title: 'Réception gros œuvre', startOffset: 15, endOffset: 15, progress: 0, isMilestone: true }),
  ]),
  lot('LOT03', 'LOT 03 — Menuiserie', [
    leaf('LOT03', {
      id: 'T-MENU-A101', title: 'Pose fenêtres A-101', startOffset: 2, endOffset: 8, progress: 0,
      dependencies: ['T-GO-COURS'], logementId: 'u-test-A101', forecastEndOffset: 13,
    }),
    leaf('LOT03', { id: 'T-MENU-B01', title: 'Pose fenêtres B-01', startOffset: 4, endOffset: 10, progress: 0, logementId: 'u-test-B01' }),
  ]),
]

const units: Unit[] = [
  { id: 'u-test-A', kind: 'building', name: 'Bâtiment A', code: 'A', sortOrder: 0 },
  { id: 'u-test-A101', parentId: 'u-test-A', kind: 'dwelling', name: 'Logement A-101', code: 'A-101', sortOrder: 0 },
  { id: 'u-test-B', kind: 'building', name: 'Bâtiment B', code: 'B', sortOrder: 1 },
  { id: 'u-test-B01', parentId: 'u-test-B', kind: 'dwelling', name: 'Logement B-01', code: 'B-01', sortOrder: 0 },
]

const taskUnits: TaskUnitLink[] = [
  { taskId: 'T-MENU-A101', unitId: 'u-test-A101' },
  { taskId: 'T-MENU-B01', unitId: 'u-test-B01' },
]

const lotsConfig: LotContact[] = [
  { id: 'LOT01', name: 'LOT 01 — Terrassement', company: 'Entreprise TEST Terrassement', contactName: '', email: '', phone: '' },
  { id: 'LOT02', name: 'LOT 02 — Gros œuvre', company: 'Entreprise TEST Gros Œuvre', contactName: '', email: '', phone: '' },
  { id: 'LOT03', name: 'LOT 03 — Menuiserie', company: 'Entreprise TEST Menuiserie', contactName: '', email: '', phone: '' },
]

/** Toutes les tranches de l'opération TEST, prêtes pour seedProjectData(). */
export function buildTestOperationSeed(): ProjectSeed {
  return { gantt, units, taskUnits, lotsConfig }
}
