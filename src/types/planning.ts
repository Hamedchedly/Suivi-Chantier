// ────────────────────────────────────────────────────────────────────────────
// PlanningTask — modèle de lecture centralisé exposé par PlanningEngine.
//
// GanttTask (types/gantt.ts) reste la forme de stockage. PlanningTask est une
// vue calculée dessus, pensée pour l'affichage : trois réalités seulement
// (contractuel / réel / prévision), jamais quatre, avec l'écart et le
// pourquoi déjà résolus une bonne fois pour toutes.
// ────────────────────────────────────────────────────────────────────────────

import { DelayCause, TaskStatus } from './gantt'
import { CommitmentOutcome } from '../lib/commitments'

/** Seul finish_to_start est aujourd'hui calculé par le moteur (cpm.ts, forecast.ts).
 * Les autres types restent modélisables (saisie, affichage) sans être propagés. */
export type PlanningDependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'

export interface PlanningDependency {
  predecessorId: string
  type: PlanningDependencyType
}

export interface PlanningCommitment {
  id: string
  company?: string
  label?: string
  promisedEnd: string
  at: string
  visitId: string
  visitDate: string
  outcome: CommitmentOutcome
}

export interface PlanningVariance {
  /** actual_start − contract_start, en jours. null tant que non démarrée. */
  startDays: number | null
  /** actual_end − contract_end, en jours. null tant que non terminée. */
  endDays: number | null
  /** forecast_end − contract_end, en jours. null en l'absence de prévision. */
  forecastDays: number | null
  /** (actual_end ?? forecast_end) − dernier engagement promis, en jours. null sans engagement. */
  commitmentDays: number | null
}

export interface PlanningTask {
  id: string
  operationId: string
  lotId: string
  parentId?: string

  title: string
  isMilestone: boolean
  isCritical: boolean
  status: TaskStatus
  progress: number

  contract: { start: Date; end: Date; workingDays?: number }
  actual: { start?: Date; end?: Date; progress: number }
  forecast: { start?: Date; end?: Date; method: 'actual_rate' | 'contractual_duration' | 'manual' | null }

  variance: PlanningVariance

  dependencies: PlanningDependency[]
  commitments: PlanningCommitment[]
  latestCommitment?: PlanningCommitment

  delayCause?: DelayCause

  children?: PlanningTask[]
}

export interface PlanningAnalysis {
  totalTasks: number
  completed: number
  inProgress: number
  notStarted: number
  drifting: number

  contractEnd: Date | null
  actualEnd: Date | null
  forecastEnd: Date | null
  varianceDays: number | null

  topVariances: { lotId: string; title: string; days: number }[]
}

export interface CriticalPathResult {
  available: boolean
  path: string[]
  criticalIds: Set<string>
}

export interface WhyLate {
  startDriftDays: number | null
  forecastDriftDays: number | null
  progress: number
  delayCause: DelayCause | null
  predecessors: { id: string; title: string }[]
  latestCommitment: PlanningCommitment | null
}
