export type ProgressValue = { percentage: number | null; status: string; quantity?: number | null; amount?: number | null }
export type Weighting = 'simple' | 'quantity' | 'amount'
export function progressAverage(values: ProgressValue[], weighting: Weighting = 'simple') {
  const applicable = values.filter((value) => value.status !== 'not_applicable' && value.percentage !== null)
  if (!applicable.length) return null
  const weight = (value: ProgressValue) => weighting === 'quantity' ? Number(value.quantity ?? 0) : weighting === 'amount' ? Number(value.amount ?? 0) : 1
  const totalWeight = applicable.reduce((sum, value) => sum + weight(value), 0)
  if (totalWeight === 0) return applicable.reduce((sum, value) => sum + Number(value.percentage), 0) / applicable.length
  return applicable.reduce((sum, value) => sum + Number(value.percentage) * weight(value), 0) / totalWeight
}
