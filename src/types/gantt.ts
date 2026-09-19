export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'delayed' | 'cancelled'

/** Cause déclarée d'un retard — saisie par l'utilisateur, jamais déduite. */
export type DelayCause =
  | 'dependance'
  | 'entreprise'
  | 'approvisionnement'
  | 'validation_moa'
  | 'validation_moe'
  | 'etude'
  | 'travaux_precedents'
  | 'acces_logement'
  | 'meteo'
  | 'modification'
  | 'avenant_ts'
  | 'autre'

export const DELAY_CAUSE_LABEL: Record<DelayCause, string> = {
  dependance: 'Dépendance',
  entreprise: 'Entreprise',
  approvisionnement: 'Approvisionnement',
  validation_moa: 'Validation MOA',
  validation_moe: 'Validation MOE',
  etude: 'Étude',
  travaux_precedents: 'Travaux précédents',
  acces_logement: 'Accès logement',
  meteo: 'Météo',
  modification: 'Modification',
  avenant_ts: 'Avenant / TS',
  autre: 'Autre',
}

export interface GanttTask {
  id: string
  parent_id?: string
  lot_id: string
  zone_id?: string
  logement_id?: string
  title: string
  description?: string

  planned_start: Date
  planned_end: Date
  planned_duration: number // jours

  actual_start?: Date
  actual_end?: Date
  actual_duration?: number

  forecast_start?: Date   // computed forecast — never user-entered
  forecast_end?: Date     // computed forecast — never user-entered
  forecast_method?: 'actual_rate' | 'contractual_duration' | 'manual' // which method was used for forecast
  contractual_working_days?: number // reference duration in working days (from baseline)

  progress: number // 0-100
  status: TaskStatus

  priority: 'low' | 'medium' | 'high' | 'critical'
  responsible_user?: string
  company_id?: string

  dependencies: string[] // IDs des tâches dont dépend celle-ci
  baseline_start?: Date
  baseline_end?: Date

  total_float?: number // marge totale (jours)
  free_float?: number // marge libre (jours)

  is_milestone: boolean
  is_critical: boolean

  delay_cause?: DelayCause

  children?: GanttTask[]
}

export interface GanttViewState {
  view: 'week' | 'month' // zoom level
  startDate: Date
  endDate: Date
  selectedLotId?: string | null // filter by lot
  selectedZoneId?: string | null // filter by logement
  depsVisible: boolean
  highlightCritical?: boolean // dim non-critical tasks
  zoom?: number // day-width multiplier (default 1)
  holidays?: { start: Date; end: Date; label?: string }[] // hatched/greyed columns
  expandedTasks: Set<string>
}
