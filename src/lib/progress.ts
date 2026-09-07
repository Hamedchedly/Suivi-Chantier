export type ProgressValue = { percentage: number | null; status: string; quantity?: number | null; amount?: number | null }
export type WeightingMethod = 'simple' | 'quantity' | 'amount'

/** Computes a progress aggregate without ever changing the underlying visit entries. */
export function progressAverage(values: ProgressValue[], weighting: WeightingMethod = 'simple'): number | null {
  const applicable = values.filter((value) => value.status !== 'not_applicable' && value.percentage !== null)
  if (applicable.length === 0) return null
  const weightFor = (value: ProgressValue) => weighting === 'quantity' ? Number(value.quantity ?? 0) : weighting === 'amount' ? Number(value.amount ?? 0) : 1
  const totalWeight = applicable.reduce((total, value) => total + weightFor(value), 0)
  if (totalWeight === 0) return applicable.reduce((total, value) => total + Number(value.percentage), 0) / applicable.length
  return applicable.reduce((total, value) => total + Number(value.percentage) * weightFor(value), 0) / totalWeight
}

export interface ProgressRow {
  task_id: string | null
  percentage: number | null
  status: string | null
  comment: string | null
  progressed_at: string
}

/** Keeps the most recent row per task among an append-only history. */
export function latestByTask(rows: ProgressRow[]): Map<string, ProgressRow> {
  const latest = new Map<string, ProgressRow>()
  for (const row of rows) {
    const key = row.task_id ?? ''
    const current = latest.get(key)
    if (!current || row.progressed_at >= current.progressed_at) latest.set(key, row)
  }
  return latest
}
