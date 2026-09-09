export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'delayed' | 'cancelled'

export interface GanttTask {
  id: string
  parent_id?: string
  lot_id: string
  title: string
  description?: string

  planned_start: Date
  planned_end: Date
  planned_duration: number // jours

  actual_start?: Date
  actual_end?: Date
  actual_duration?: number

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

  children?: GanttTask[]
}

export interface GanttViewState {
  view: 'week' | 'month' // zoom level
  startDate: Date
  endDate: Date
  selectedLotId?: string | null // filter by lot
  depsVisible: boolean
  expandedTasks: Set<string>
}
