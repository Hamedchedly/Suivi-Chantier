import { useState, useEffect, Fragment } from 'react'
import { Plus, Trash2, Flag, X } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import { getGanttTasks, saveGanttTasks, getHolidays, saveHolidays, Holiday } from '../../lib/repo'
import { endDrift, startDrift } from '../../lib/actualDates'
import {
  PlanningError, PLANNING_ERROR_LABEL, createLot, createTask, renameTask,
  setTaskDates, removeTask,
} from '../../lib/planning'
import { SavedIndicator } from '../common/SavedIndicator'

const iso = (d: Date) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr-FR') : '—')

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

interface DraftTask { title: string; start: string; duration: string; milestone: boolean }
const emptyDraft = (): DraftTask => ({ title: '', start: iso(new Date()), duration: '5', milestone: false })

export function PlanningConfig() {
  const [tasks, setTasks] = useState<GanttTask[]>(getGanttTasks)
  const [holidays, setHolidays] = useState<Holiday[]>(getHolidays)

  // Création de lot
  const [lotForm, setLotForm] = useState<{ code: string; title: string } | null>(null)
  // Création de tâche, par lot (id du lot → brouillon ouvert)
  const [taskDraft, setTaskDraft] = useState<{ lotId: string; draft: DraftTask } | null>(null)
  const [error, setError] = useState<PlanningError | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  useEffect(() => { saveGanttTasks(tasks) }, [tasks])
  useEffect(() => { saveHolidays(holidays) }, [holidays])

  // Semaine de référence S0 = lundi du démarrage prévisionnel le plus tôt.
  const starts = tasks.flatMap(l => (l.children ?? []).map(c => c.planned_start.getTime()))
  const projStart = new Date(Math.min(...(starts.length ? starts : [Date.now()])))
  const weekOf = (d: Date) => Math.floor((d.getTime() - projStart.getTime()) / (7 * 86400000))

  const apply = (res: ReturnType<typeof createLot>) => {
    if (!res.ok) { setError(res.error ?? null); return false }
    setTasks(res.tasks); setError(null); return true
  }

  const submitLot = () => {
    if (!lotForm) return
    if (apply(createLot(tasks, lotForm))) setLotForm(null)
  }

  const submitTask = () => {
    if (!taskDraft) return
    const { lotId, draft } = taskDraft
    const res = createTask(tasks, lotId, {
      title: draft.title,
      start: parse(draft.start),
      duration: Math.max(1, parseInt(draft.duration, 10) || 1),
      is_milestone: draft.milestone,
    })
    if (apply(res)) setTaskDraft({ lotId, draft: emptyDraft() })   // reste ouvert pour enchaîner
  }

  const setStart = (id: string, value: string) => {
    if (value) setTasks(prev => setTaskDates(prev, id, { start: parse(value) }).tasks)
  }
  const setEnd = (id: string, value: string) => {
    if (value) setTasks(prev => setTaskDates(prev, id, { end: parse(value) }).tasks)
  }
  const rename = (id: string, title: string) =>
    setTasks(prev => { const r = renameTask(prev, id, title); return r.ok ? r.tasks : prev })
  const remove = (id: string) => { setTasks(prev => removeTask(prev, id).tasks); setConfirm(null) }

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
    <div style={{ maxWidth: '1040px' }}>
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

      {/* Planning : lots, tâches et dates contractuelles */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--navy)' }}>Planning — lots &amp; tâches</h3>
          {!lotForm && <button onClick={() => { setLotForm({ code: '', title: '' }); setError(null) }} style={btnSm}><Plus size={14} /> Ajouter un lot</button>}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          La date contractuelle est la date prévisionnelle : une seule saisie par tâche.
          Les dates <strong>réelles</strong> ne se saisissent pas — elles se calent automatiquement sur
          l'avancement constaté en visite. Semaine de démarrage = S0.
        </p>

        {/* Formulaire nouveau lot */}
        {lotForm && (
          <div style={formBox}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ flex: 1, fontSize: '13px', color: 'var(--navy)' }}>Nouveau lot</strong>
              <button onClick={() => { setLotForm(null); setError(null) }} style={iconBtn}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input autoFocus value={lotForm.code} placeholder="Code (ex. L01)"
                onChange={e => setLotForm({ ...lotForm, code: e.target.value })}
                style={{ ...inp, flex: '0 1 120px' }} />
              <input value={lotForm.title} placeholder="Intitulé du lot (ex. Démolition / Structure)"
                onChange={e => setLotForm({ ...lotForm, title: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') submitLot() }}
                style={{ ...inp, flex: '2 1 240px' }} />
              <button onClick={submitLot} style={primaryBtn}>Créer le lot</button>
            </div>
            {error && <div style={errMsg}>{PLANNING_ERROR_LABEL[error]}</div>}
          </div>
        )}

        {tasks.length === 0 && !lotForm && (
          <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '18px', border: '1px dashed var(--line)', borderRadius: '10px' }}>
            Aucun lot. Ajoutez un lot, puis ses tâches, pour construire le planning.
          </div>
        )}

        {tasks.length > 0 && (
          // Le tableau défile horizontalement sur mobile plutôt que de se replier
          // en une pile d'étiquettes : les colonnes restent comparables.
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '10px', background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '860px', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ ...th, ...stickyLeft, textAlign: 'left', minWidth: '190px', zIndex: 3 }}>Tâche</th>
                  <th style={th}>Semaines</th>
                  <th style={th}>Début contractuel</th>
                  <th style={th}>Fin contractuelle</th>
                  <th style={th}>Durée</th>
                  <th style={th}>Avanc.</th>
                  <th style={th}>Début réel</th>
                  <th style={th}>Fin réelle</th>
                  <th style={th}>Écart fin</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(lot => (
                  <Fragment key={lot.id}>
                    <tr>
                      <td colSpan={9} style={{ padding: '9px 10px', background: 'var(--sky-soft)', fontWeight: 700, color: 'var(--navy)', borderTop: '1px solid var(--line)' }}>
                        {lot.lot_id ? <span style={{ color: 'var(--accent)' }}>{lot.lot_id} · </span> : null}{lot.title}
                      </td>
                      <td style={{ padding: '6px 8px', background: 'var(--sky-soft)', borderTop: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setTaskDraft({ lotId: lot.id, draft: emptyDraft() }); setError(null) }} style={miniBtn} title="Ajouter une tâche"><Plus size={13} /></button>
                        <button onClick={() => setConfirm(lot.id)} style={{ ...miniBtn, color: '#b42318' }} title="Supprimer le lot"><Trash2 size={13} /></button>
                      </td>
                    </tr>

                    {confirm === lot.id && (
                      <tr><td colSpan={10} style={{ padding: '8px 10px', background: '#fdecec' }}>
                        <span style={{ fontSize: '11px', color: '#7a1c13', marginRight: '10px' }}>
                          Supprimer le lot « {lot.title} » et ses {(lot.children ?? []).length} tâche(s) ?
                        </span>
                        <button onClick={() => remove(lot.id)} style={dangerBtn}>Supprimer</button>
                        <button onClick={() => setConfirm(null)} style={ghostBtn}>Annuler</button>
                      </td></tr>
                    )}

                    {(lot.children ?? []).map(t => (
                      <tr key={t.id}>
                        <td style={{ ...td, ...stickyLeft, textAlign: 'left', background: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {t.is_milestone && <Flag size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                            <input value={t.title} onChange={e => rename(t.id, e.target.value)}
                              style={{ ...cellInput, width: '100%', minWidth: '150px', border: '1px solid transparent', background: 'transparent' }}
                              onFocus={e => (e.currentTarget.style.border = '1px solid var(--line)')}
                              onBlur={e => (e.currentTarget.style.border = '1px solid transparent')} />
                          </div>
                        </td>
                        <td style={{ ...td, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          S{weekOf(t.planned_start)}–S{weekOf(t.planned_end)}
                        </td>
                        <td style={td}>
                          <input type="date" value={iso(t.planned_start)} onChange={e => setStart(t.id, e.target.value)} style={cellInput} />
                        </td>
                        <td style={td}>
                          <input type="date" value={iso(t.planned_end)} onChange={e => setEnd(t.id, e.target.value)} style={cellInput} />
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
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <button onClick={() => setConfirm(t.id)} style={{ ...miniBtn, color: '#b42318' }} title="Supprimer la tâche"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}

                    {confirm && (lot.children ?? []).some(c => c.id === confirm) && (
                      <tr><td colSpan={10} style={{ padding: '8px 10px', background: '#fdecec' }}>
                        <span style={{ fontSize: '11px', color: '#7a1c13', marginRight: '10px' }}>Supprimer cette tâche ?</span>
                        <button onClick={() => remove(confirm)} style={dangerBtn}>Supprimer</button>
                        <button onClick={() => setConfirm(null)} style={ghostBtn}>Annuler</button>
                      </td></tr>
                    )}

                    {/* Ligne de saisie d'une nouvelle tâche */}
                    {taskDraft?.lotId === lot.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: '10px', background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input autoFocus value={taskDraft.draft.title} placeholder="Intitulé de la tâche"
                              onChange={e => setTaskDraft({ lotId: lot.id, draft: { ...taskDraft.draft, title: e.target.value } })}
                              onKeyDown={e => { if (e.key === 'Enter') submitTask() }}
                              style={{ ...inp, flex: '2 1 200px' }} />
                            <label style={{ fontSize: '11px', color: 'var(--muted)' }}>Début</label>
                            <input type="date" value={taskDraft.draft.start}
                              onChange={e => setTaskDraft({ lotId: lot.id, draft: { ...taskDraft.draft, start: e.target.value } })} style={inp} />
                            <label style={{ fontSize: '11px', color: 'var(--muted)' }}>Durée (j)</label>
                            <input type="number" min={1} value={taskDraft.draft.duration}
                              onChange={e => setTaskDraft({ lotId: lot.id, draft: { ...taskDraft.draft, duration: e.target.value } })}
                              style={{ ...inp, width: '64px' }} />
                            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={taskDraft.draft.milestone}
                                onChange={e => setTaskDraft({ lotId: lot.id, draft: { ...taskDraft.draft, milestone: e.target.checked } })} />
                              Jalon
                            </label>
                            <button onClick={submitTask} style={primaryBtn}>Ajouter</button>
                            <button onClick={() => setTaskDraft(null)} style={ghostBtn}>Fermer</button>
                          </div>
                          {error && taskDraft?.lotId === lot.id && <div style={errMsg}>{PLANNING_ERROR_LABEL[error]}</div>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {leaves.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--muted)', marginTop: '10px' }}>
            Les modifications sont enregistrées automatiquement.
            <SavedIndicator watch={tasks} />
          </div>
        )}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', boxSizing: 'border-box', fontFamily: 'inherit' }
const btnSm: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }
const miniBtn: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 5px' }
const primaryBtn: React.CSSProperties = { padding: '7px 13px', borderRadius: '7px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }
const dangerBtn: React.CSSProperties = { padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#b42318', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginRight: '6px' }
const ghostBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', cursor: 'pointer' }
const iconBtn: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }
const formBox: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '12px', background: '#fff' }
const errMsg: React.CSSProperties = { fontSize: '12px', color: '#b42318', marginTop: '8px' }
const th: React.CSSProperties = { padding: '9px 10px', textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)', background: '#f8fafc', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', position: 'sticky', top: 0 }
const td: React.CSSProperties = { padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }
// Colonne « Tâche » figée à gauche : le libellé reste lisible pendant le défilement horizontal.
const stickyLeft: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 0 var(--line)' }
const cellInput: React.CSSProperties = { padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', boxSizing: 'border-box', width: '140px', fontFamily: 'inherit' }
