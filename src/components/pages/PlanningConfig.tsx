import { useState, useEffect, Fragment } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import { getGanttTasks, saveGanttTasks, getHolidays, saveHolidays, Holiday } from '../../lib/repo'
import { endDrift, startDrift } from '../../lib/actualDates'

const iso = (d: Date) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr-FR') : '—')
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1

// Recursively set a field on the matching task.
function updateTask(list: GanttTask[], id: string, patch: Partial<GanttTask>): GanttTask[] {
  return list.map(t => {
    if (t.id === id) return { ...t, ...patch }
    if (t.children?.length) return { ...t, children: updateTask(t.children, id, patch) }
    return t
  })
}

/** Écart en jours, rendu lisible : « +7 j », « −3 j », « à l'heure ». */
function DriftCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--muted)' }}>—</span>
  if (value === 0) return <span style={{ color: 'var(--ok)', fontWeight: 600 }}>à l'heure</span>
  const late = value > 0
  return (
    <span style={{ color: late ? 'var(--bad, #b42318)' : 'var(--ok)', fontWeight: 700 }}>
      {late ? '+' : '−'}{Math.abs(value)} j
    </span>
  )
}

export function PlanningConfig() {
  const [tasks, setTasks] = useState<GanttTask[]>(getGanttTasks)
  const [holidays, setHolidays] = useState<Holiday[]>(getHolidays)

  useEffect(() => { saveGanttTasks(tasks) }, [tasks])
  useEffect(() => { saveHolidays(holidays) }, [holidays])

  // Semaine de référence S0 = lundi du démarrage prévisionnel le plus tôt.
  const starts = tasks.flatMap(l => (l.children ?? []).map(c => c.planned_start.getTime()))
  const projStart = new Date(Math.min(...(starts.length ? starts : [Date.now()])))
  const weekOf = (d: Date) => Math.floor((d.getTime() - projStart.getTime()) / (7 * 86400000))

  /**
   * Le prévisionnel EST le contractuel : une seule paire de dates à saisir.
   * Déplacer le début conserve la durée ; changer la fin recalcule la durée.
   */
  const setPlannedStart = (t: GanttTask, value: string) => {
    if (!value) return
    const start = parse(value)
    const end = new Date(start.getTime() + (t.planned_duration - 1) * 86400000)
    setTasks(prev => updateTask(prev, t.id, { planned_start: start, planned_end: end }))
  }
  const setPlannedEnd = (t: GanttTask, value: string) => {
    if (!value) return
    const end = parse(value)
    if (end.getTime() < t.planned_start.getTime()) return   // fin avant début : ignoré
    setTasks(prev => updateTask(prev, t.id, { planned_end: end, planned_duration: days(t.planned_start, end) }))
  }

  const addHoliday = () => {
    const s = new Date(); s.setHours(0, 0, 0, 0)
    const e = new Date(s.getTime() + 7 * 86400000)
    setHolidays(prev => [...prev, { start: s, end: e, label: 'Congés' }])
  }
  const updateHoliday = (i: number, patch: Partial<Holiday>) =>
    setHolidays(prev => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)))
  const removeHoliday = (i: number) => setHolidays(prev => prev.filter((_, idx) => idx !== i))

  const leaves = tasks.flatMap(lot => (lot.children ?? []).map(t => ({ lot, t })))

  return (
    <div style={{ maxWidth: '980px' }}>
      {/* Congés */}
      <div style={{ marginBottom: '22px' }}>
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

      {/* Dates contractuelles — saisie en tableau */}
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--navy)' }}>Dates contractuelles</h3>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          La date contractuelle est la date prévisionnelle : une seule saisie par tâche.
          Les dates <strong>réelles</strong> ne se saisissent pas — elles se calent automatiquement sur
          l'avancement constaté en visite. Semaine de démarrage = S0.
        </p>

        {leaves.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '18px', border: '1px dashed var(--line)', borderRadius: '10px' }}>
            Aucune tâche au planning. Importez ou créez votre planning pour saisir les dates.
          </div>
        )}

        {leaves.length > 0 && (
          // Le tableau défile horizontalement sur mobile plutôt que de se replier
          // en une pile d'étiquettes : les colonnes restent comparables.
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '10px', background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '760px', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left', minWidth: '190px' }}>Tâche</th>
                  <th style={th}>Semaines</th>
                  <th style={th}>Début contractuel</th>
                  <th style={th}>Fin contractuelle</th>
                  <th style={th}>Durée</th>
                  <th style={th}>Avanc.</th>
                  <th style={th}>Début réel</th>
                  <th style={th}>Fin réelle</th>
                  <th style={th}>Écart fin</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(lot => (
                  <Fragment key={lot.id}>
                    <tr>
                      <td colSpan={9} style={{ padding: '9px 10px', background: 'var(--sky-soft)', fontWeight: 700, color: 'var(--navy)', borderTop: '1px solid var(--line)' }}>
                        {lot.title}
                      </td>
                    </tr>
                    {(lot.children ?? []).map(t => (
                      <tr key={t.id}>
                        <td style={{ ...td, textAlign: 'left' }}>
                          {t.title}{t.is_milestone ? ' ◆' : ''}
                        </td>
                        <td style={{ ...td, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          S{weekOf(t.planned_start)}–S{weekOf(t.planned_end)}
                        </td>
                        <td style={td}>
                          <input type="date" value={iso(t.planned_start)}
                            onChange={e => setPlannedStart(t, e.target.value)} style={cellInput} />
                        </td>
                        <td style={td}>
                          <input type="date" value={iso(t.planned_end)}
                            onChange={e => setPlannedEnd(t, e.target.value)} style={cellInput} />
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.planned_duration} j</td>
                        <td style={{ ...td, fontWeight: 600 }}>{t.progress}%</td>
                        <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {fmt(t.actual_start)}
                          {startDrift(t) !== null && startDrift(t) !== 0 && (
                            <div style={{ fontSize: '10px' }}><DriftCell value={startDrift(t)} /></div>
                          )}
                        </td>
                        <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmt(t.actual_end)}</td>
                        <td style={td}><DriftCell value={endDrift(t)} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '10px' }}>
          Les modifications sont enregistrées automatiquement.
        </div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', boxSizing: 'border-box' }
const btnSm: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }
const th: React.CSSProperties = { padding: '9px 10px', textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)', background: '#f8fafc', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', position: 'sticky', top: 0 }
const td: React.CSSProperties = { padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }
const cellInput: React.CSSProperties = { padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', boxSizing: 'border-box', width: '140px' }
