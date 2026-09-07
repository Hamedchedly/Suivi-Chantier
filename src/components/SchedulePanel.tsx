import { useEffect, useMemo, useState } from 'react'
import { listScheduleItems } from '../lib/data'
import type { Lot, Operation, ScheduleItem, Unit } from '../lib/types'

type Props = { operation: Operation; units: Unit[]; lots: Lot[] }
type ViewMode = 'lots' | 'dwellings'

const fmt = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—')
const day = (iso: string): number => new Date(iso).getTime() / 86400000
const STATUS_OPTIONS: Record<string, string> = { in_progress: 'En cours', done: 'Terminé', blocked: 'Bloqué', postponed: 'Reporté', not_started: 'Non commencé' }

function isLate(item: ScheduleItem, today: number): boolean {
  if (!item.planned_end || item.progress === null) return false
  return item.progress < 100 && day(item.planned_end) < today
}

export function SchedulePanel({ operation, units, lots }: Props) {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('lots')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listScheduleItems(operation.id)
      .then((rows) => { if (!cancelled) setItems(rows) })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [operation.id])

  const today = useMemo(() => Math.floor(Date.now() / 86400000), [])
  const bounds = useMemo(() => {
    const dates = items.flatMap((item) => [item.planned_start, item.planned_end, item.actual_start, item.actual_end]).filter((value): value is string => Boolean(value))
    if (dates.length === 0) return null
    const start = Math.min(...dates.map(day))
    const end = Math.max(...dates.map(day))
    return { start, span: Math.max(1, end - start) }
  }, [items])

  const byLot = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const item of items) {
      if (!item.lot_id) continue
      const list = map.get(item.lot_id) ?? []
      list.push(item)
      map.set(item.lot_id, list)
    }
    return map
  }, [items])

  const orderedLots = [...lots].sort((a, b) => a.sort_order - b.sort_order)
  const buildings = units.filter((unit) => unit.kind === 'building')
  const isDwellingUnit = (unit: Unit) => unit.kind === 'dwelling' || unit.kind === 'common_area' || unit.kind === 'exterior' || unit.kind === 'zone'

  if (loading) return <section className="stack"><p className="eyebrow">{operation.name}</p><h2>Planning</h2><p className="notice">Chargement…</p></section>
  if (error) return <section className="stack"><p className="eyebrow">{operation.name}</p><h2>Planning</h2><p className="notice error">{error}</p></section>

  return (
    <section className="stack">
      <div className="hero">
        <p className="eyebrow">{operation.name}</p>
        <h2>Planning chantier</h2>
        <div className="segmented">
          <button type="button" className={mode === 'lots' ? 'active' : ''} onClick={() => setMode('lots')}>Lots</button>
          <button type="button" className={mode === 'dwellings' ? 'active' : ''} onClick={() => setMode('dwellings')}>Logements</button>
        </div>
      </div>
      {mode === 'lots' && orderedLots.map((lot) => {
        const lotItems = byLot.get(lot.id) ?? []
        if (lotItems.length === 0) return null
        return (
          <div key={lot.id} className="panel lot">
            <h3>{lot.number ?? lot.code ?? ''} — {lot.name}</h3>
            {lotItems.map((item) => {
              const start = item.planned_start ?? item.actual_start
              const end = item.planned_end ?? item.actual_end
              const late = isLate(item, today)
              const left = bounds && start ? Math.max(0, ((day(start) - bounds.start) / bounds.span) * 100) : 0
              const width = bounds && start && end ? Math.min(100 - left, Math.max(2, ((day(end) - Math.max(day(start), bounds.start)) / bounds.span) * 100)) : 0
              return (
                <div key={item.id} className="gantt-row">
                  <div className="gantt-label">
                    <strong>{item.title}</strong>
                    <span className="muted small">{fmt(start)} → {fmt(end)}</span>
                  </div>
                  <div className="gantt-track">
                    <div className="gantt-bar" style={{ left: `${left}%`, width: `${width}%` }} />
                  </div>
                  <div className="gantt-meta">
                    <span className="chip">{item.progress === null ? 'Non suivi' : `${Math.round(item.progress)} %`}</span>
                    {item.status ? <span className="chip muted">{STATUS_OPTIONS[item.status] ?? item.status}</span> : null}
                    {late && <span className="chip warn">En retard</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {mode === 'dwellings' && buildings.map((building) => {
        const children = units.filter((unit) => unit.parent_id === building.id && isDwellingUnit(unit))
        return (
          <div key={building.id} className="panel lot">
            <h3>{building.code ?? ''} {building.name}</h3>
            {children.map((unit) => {
              const unitItems = items.filter((item) => item.unit_id === unit.id)
              return (
                <div key={unit.id}>
                  <p className="muted">{unit.code ?? ''} {unit.name}{unit.floor ? ` · ${unit.floor}` : ''}</p>
                  {unitItems.length === 0 && <p className="small muted">Aucun élément planifié pour cette localisation.</p>}
                  {unitItems.map((item) => {
                    const late = isLate(item, today)
                    return (
                      <div key={item.id} className="gantt-row compact">
                        <div className="gantt-label"><strong>{item.title}</strong><span className="muted small">{fmt(item.planned_start ?? item.actual_start)} → {fmt(item.planned_end ?? item.actual_end)}</span></div>
                        <div className="gantt-meta"><span className="chip">{item.progress === null ? 'Non suivi' : `${Math.round(item.progress)} %`}</span>{late && <span className="chip warn">En retard</span>}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {children.length === 0 && <p className="muted small">Aucune localisation rattachée.</p>}
          </div>
        )
      })}
    </section>
  )
}