import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import { getGanttTasks, saveGanttTasks, getHolidays, saveHolidays, Holiday } from '../../lib/repo'

const iso = (d: Date) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

// Recursively set a field on the matching task.
function updateTask(list: GanttTask[], id: string, patch: Partial<GanttTask>): GanttTask[] {
  return list.map(t => {
    if (t.id === id) return { ...t, ...patch }
    if (t.children?.length) return { ...t, children: updateTask(t.children, id, patch) }
    return t
  })
}

export function PlanningConfig() {
  const [tasks, setTasks] = useState<GanttTask[]>(getGanttTasks)
  const [holidays, setHolidays] = useState<Holiday[]>(getHolidays)

  useEffect(() => { saveGanttTasks(tasks) }, [tasks])
  useEffect(() => { saveHolidays(holidays) }, [holidays])

  // Project start = Monday of earliest baseline, for S0/S1 reference numbering.
  const starts = tasks.flatMap(l => (l.children ?? []).map(c => (c.baseline_start ?? c.planned_start).getTime()))
  const projStart = new Date(Math.min(...(starts.length ? starts : [Date.now()])))
  const weekOf = (d: Date) => Math.floor((d.getTime() - projStart.getTime()) / (7 * 86400000))

  const setBaseline = (id: string, field: 'baseline_start' | 'baseline_end', value: string) => {
    if (!value) return
    setTasks(prev => updateTask(prev, id, { [field]: parse(value) }))
  }

  const addHoliday = () => {
    const s = new Date(); s.setHours(0, 0, 0, 0)
    const e = new Date(s.getTime() + 7 * 86400000)
    setHolidays(prev => [...prev, { start: s, end: e, label: 'Congés' }])
  }
  const updateHoliday = (i: number, patch: Partial<Holiday>) =>
    setHolidays(prev => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)))
  const removeHoliday = (i: number) => setHolidays(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Holidays */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--navy)' }}>Congés / semaines non travaillées</h3>
          <button onClick={addHoliday} style={btnSm}><Plus size={14} /> Ajouter</button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 10px' }}>
          Les colonnes correspondantes sont hachurées sur le planning.
        </p>
        {holidays.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Aucune période définie.</div>}
        {holidays.map((h, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <input value={h.label ?? ''} onChange={e => updateHoliday(i, { label: e.target.value })} placeholder="Libellé" style={{ ...inp, flex: '1 1 120px' }} />
            <input type="date" value={iso(h.start)} onChange={e => updateHoliday(i, { start: parse(e.target.value) })} style={inp} />
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>→</span>
            <input type="date" value={iso(h.end)} onChange={e => updateHoliday(i, { end: parse(e.target.value) })} style={inp} />
            <button onClick={() => removeHoliday(i)} style={{ ...btnSm, border: 'none', color: 'var(--bad)' }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {/* Task contractual dates */}
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--navy)' }}>Dates contractuelles des tâches</h3>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 12px' }}>
          Semaine de démarrage = S0. Le planifié (barre pleine) se règle en glissant les barres ; ici on fixe le contractuel (hachuré).
        </p>
        {tasks.map(lot => (
          <div key={lot.id} style={{ marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '13px', marginBottom: '6px' }}>{lot.title}</div>
            {(lot.children ?? []).map(t => {
              const bs = t.baseline_start ?? t.planned_start
              const be = t.baseline_end ?? t.planned_end
              return (
                <div key={t.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', paddingLeft: '10px' }}>
                  <span style={{ flex: '1 1 130px', fontSize: '12px', color: 'var(--ink)' }}>
                    {t.title}{t.is_milestone ? ' ◆' : ''}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, minWidth: '54px' }}>S{weekOf(bs)}–S{weekOf(be)}</span>
                  <input type="date" value={iso(bs)} onChange={e => setBaseline(t.id, 'baseline_start', e.target.value)} style={inp} />
                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>→</span>
                  <input type="date" value={iso(be)} onChange={e => setBaseline(t.id, 'baseline_end', e.target.value)} style={inp} />
                </div>
              )
            })}
          </div>
        ))}
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Les modifications sont enregistrées automatiquement.</div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', boxSizing: 'border-box' }
const btnSm: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }
