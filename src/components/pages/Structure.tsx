import React, { useState, useEffect, useMemo } from 'react'
import {
  Building2, ChevronDown, ChevronRight, DoorClosed, Layers, Pencil, Plus,
  Trees, Trash2, Users, X, MoreHorizontal,
} from 'lucide-react'
import {
  Unit, UnitKind, UnitInput, UnitError, TaskUnitLink, UNIT_KIND_LABEL, ALLOWED_CHILDREN,
  UNIT_ERROR_LABEL, createUnit, renameUnit, deleteUnit, childrenOf, roots, findUnit,
  unitPath, isLinked, unitIdsForTask, taskIdsForUnit, pruneLinks,
} from '../../lib/units'
import { GanttTask } from '../../types/gantt'
import { Reserve } from '../../lib/reserves'
import { getUnits, saveUnits, getTaskUnits, saveTaskUnits, getGanttTasks, saveGanttTasks, getReserves } from '../../lib/repo'
import { SavedIndicator } from '../common/SavedIndicator'

const KIND_ICON: Record<UnitKind, typeof Building2> = {
  building: Building2,
  level: Layers,
  dwelling: DoorClosed,
  common: Users,
  exterior: Trees,
}

type Mode = 'zones' | 'taches' | 'vue'

export function Structure() {
  const [units, setUnits] = useState<Unit[]>(getUnits)
  const [links, setLinks] = useState<TaskUnitLink[]>(getTaskUnits)
  const [mode, setMode] = useState<Mode>('zones')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(getUnits().map(u => u.id)))
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [checkedUnits, setCheckedUnits] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  // Actions d'une ligne repliées dans un menu « … » pour ne pas saturer le mobile.
  const [menuUnit, setMenuUnit] = useState<string | null>(null)
  // Signature légère : ne change que si la structure ou un rattachement change.
  const savedSignature = useMemo(
    () => units.map(u => `${u.id}:${u.name}:${u.code ?? ''}:${u.parentId ?? ''}`).join('|')
      + '#' + links.map(l => `${l.taskId}~${l.unitId}`).join('|'),
    [units, links],
  )

  // Formulaire de création / renommage
  const [form, setForm] = useState<(UnitInput & { editing?: string }) | null>(null)
  const [error, setError] = useState<UnitError | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  useEffect(() => { saveUnits(units) }, [units])
  useEffect(() => { saveTaskUnits(links) }, [links])

  // Le planning fournit les tâches rattachables, groupées par lot. En état local
  // pour qu'une tâche saisie ici apparaisse aussitôt et soit persistée.
  const [gantt, setGantt] = useState<GanttTask[]>(getGanttTasks)
  const lots = gantt
  const leaves = useMemo(
    () => gantt.flatMap(lot => (lot.children ?? []).map(t => ({ lot, task: t }))),
    [gantt],
  )
  useEffect(() => { saveGanttTasks(gantt) }, [gantt])

  const [reserves] = useState<Reserve[]>(getReserves)

  const taskStatsForUnit = (uid: string) => {
    const taskIds = taskIdsForUnit(links, uid)
    if (taskIds.length === 0) return null
    const matched = leaves.filter(l => taskIds.includes(l.task.id))
    const avg = Math.round(matched.reduce((s, l) => s + l.task.progress, 0) / matched.length)
    return { count: matched.length, avg, tasks: matched }
  }

  const openReservesForUnit = (uid: string) =>
    reserves.filter(r => r.logementId === uid && r.status === 'open').length

  /** Coche/décoche en bloc un ensemble de tâches pour une (ou plusieurs) unité(s). */
  const setLinksFor = (taskIds: string[], unitId: string, on: boolean) => {
    const targets = checkedUnits.size > 0 ? [...checkedUnits] : [unitId]
    setLinks(prev => {
      const others = prev.filter(l => !(targets.includes(l.unitId) && taskIds.includes(l.taskId)))
      return on ? [...others, ...targets.flatMap(uid => taskIds.map(taskId => ({ taskId, unitId: uid })))] : others
    })
  }

  /** Saisie manuelle d'une tâche : nouvelle feuille rattachée à un lot, datée par défaut sur aujourd'hui. */
  const addManualTask = (lot: GanttTask, title: string, unitId?: string | null) => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 4)
    const leaf: GanttTask = {
      id: `t${Date.now()}`, parent_id: lot.id, lot_id: lot.lot_id, title: title.trim(),
      planned_start: start, planned_end: end, planned_duration: 5,
      progress: 0, status: 'not-started', priority: 'medium',
      dependencies: [], is_milestone: false, is_critical: false,
    }
    setGantt(prev => prev.map(l => {
      if (l.id !== lot.id) return l
      const children = [...(l.children ?? []), leaf]
      const s = new Date(Math.min(l.planned_start.getTime(), start.getTime()))
      const e = new Date(Math.max(l.planned_end.getTime(), end.getTime()))
      const progress = Math.round(children.reduce((a, c) => a + c.progress, 0) / children.length)
      return { ...l, children, planned_start: s, planned_end: e, progress }
    }))
    if (unitId) setLinks(prev => (isLinked(prev, leaf.id, unitId) ? prev : [...prev, { taskId: leaf.id, unitId }]))
  }

  // Un lien dont la tâche ou l'unité a disparu n'a plus de sens.
  useEffect(() => {
    const cleaned = pruneLinks(links, units.map(u => u.id), leaves.map(l => l.task.id))
    if (cleaned.length !== links.length) setLinks(cleaned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, leaves])

  const toggleExpand = (id: string) => setExpanded(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const startCreate = (parentId: string | undefined, kind: UnitKind) => {
    setForm({ name: '', kind, code: '', parentId })
    setError(null)
  }
  const startEdit = (unit: Unit) => {
    setForm({ name: unit.name, kind: unit.kind, code: unit.code ?? '', parentId: unit.parentId, editing: unit.id })
    setError(null)
  }

  const submit = () => {
    if (!form) return
    const res = form.editing
      ? renameUnit(units, form.editing, { name: form.name, code: form.code })
      : createUnit(units, form)
    if (!res.ok) { setError(res.error ?? null); return }
    setUnits(res.units)
    if (!form.editing && res.unit) {
      setExpanded(prev => new Set([...prev, res.unit!.id, ...(form.parentId ? [form.parentId] : [])]))
      setSelectedUnit(res.unit.id)
    }
    setForm(null)
  }

  const remove = (id: string) => {
    const res = deleteUnit(units, id)
    if (res.ok) {
      setUnits(res.units)
      if (selectedUnit === id) setSelectedUnit(null)
    }
    setConfirm(null)
  }

  /** Coche/décoche pour une tâche, appliqué à toutes les unités sélectionnées. */
  const flip = (taskId: string, unitId: string) => {
    const targets = checkedUnits.size > 0 ? [...checkedUnits] : [unitId]
    const on = !isLinked(links, taskId, unitId)
    setLinks(prev => {
      let next = prev.filter(l => !(targets.includes(l.unitId) && l.taskId === taskId))
      if (on) next = [...next, ...targets.map(uid => ({ taskId, unitId: uid }))]
      return next
    })
  }

  const toggleCheckedUnit = (uid: string) =>
    setCheckedUnits(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n })

  // ── Arbre des unités ──────────────────────────────────────────────────────
  const renderUnit = (unit: Unit, depth: number) => {
    const kids = childrenOf(units, unit.id)
    const Icon = KIND_ICON[unit.kind]
    const open = expanded.has(unit.id)
    const selected = selectedUnit === unit.id
    const checked = checkedUnits.has(unit.id)
    const canHold = ALLOWED_CHILDREN[unit.kind]
    const nTasks = taskIdsForUnit(links, unit.id).length

    return (
      <div key={unit.id}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 8px', paddingLeft: `${8 + depth * 16}px`,
          borderRadius: '8px', marginBottom: '2px',
          background: selected ? 'var(--sky-soft)' : checked ? '#f0f9ff' : 'transparent',
          border: selected ? '1px solid var(--accent)' : checked ? '1px solid #bae6fd' : '1px solid transparent',
        }}>
          <input type="checkbox" checked={checked} onChange={() => toggleCheckedUnit(unit.id)}
            title="Sélectionner pour opération groupée"
            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }} />
          <button
            onClick={() => kids.length && toggleExpand(unit.id)}
            style={{ ...iconBtn, visibility: kids.length ? 'visible' : 'hidden' }}
            aria-label={open ? 'Replier' : 'Déplier'}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <Icon size={15} style={{ color: 'var(--navy)', flexShrink: 0 }} />

          <button onClick={() => setSelectedUnit(unit.id)}
            style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0, minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: selected ? 700 : 500, color: 'var(--navy)' }}>
              {unit.name}
            </span>
            {unit.code && <span style={{ fontSize: '11px', color: 'var(--muted)' }}> · {unit.code}</span>}
            <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '6px' }}>
              {UNIT_KIND_LABEL[unit.kind]}
            </span>
            {nTasks > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', marginLeft: '6px' }}>
                {nTasks} tâche{nTasks > 1 ? 's' : ''}
              </span>
            )}
          </button>

          <button
            onClick={() => { setMenuUnit(m => (m === unit.id ? null : unit.id)); setConfirm(null) }}
            style={{ ...iconBtn, background: menuUnit === unit.id ? 'var(--line)' : 'none', borderRadius: '6px' }}
            aria-label={`Actions pour ${unit.name}`} aria-expanded={menuUnit === unit.id}>
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Menu d'actions de la ligne — ajouts, renommage, suppression */}
        {menuUnit === unit.id && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: `${8 + depth * 16}px`, marginBottom: '6px', padding: '8px', border: '1px solid var(--line)', borderRadius: '8px', background: '#fff' }}>
            {canHold.map(kind => (
              <button key={kind} onClick={() => { startCreate(unit.id, kind); setMenuUnit(null) }} style={menuBtn}>
                <Plus size={13} /> {UNIT_KIND_LABEL[kind]}
              </button>
            ))}
            <button onClick={() => { startEdit(unit); setMenuUnit(null) }} style={menuBtn}>
              <Pencil size={13} /> Renommer
            </button>
            <button onClick={() => { setConfirm(unit.id); setMenuUnit(null) }} style={{ ...menuBtn, color: '#b42318', borderColor: '#f3c9c4' }}>
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        )}

        {confirm === unit.id && (
          <div style={{ ...confirmBox, marginLeft: `${8 + depth * 16}px` }}>
            <span style={{ flex: 1, fontSize: '11px', color: '#7a1c13' }}>
              Supprimer « {unit.name} » et tout ce qu'il contient ?
            </span>
            <button onClick={() => remove(unit.id)} style={dangerBtn}>Supprimer</button>
            <button onClick={() => setConfirm(null)} style={ghostBtn}>Annuler</button>
          </div>
        )}

        {open && kids.map(c => renderUnit(c, depth + 1))}
      </div>
    )
  }

  // ── Panneaux de rattachement ──────────────────────────────────────────────
  const unit = findUnit(units, selectedUnit)
  const task = leaves.find(l => l.task.id === selectedTask)

  const allTaskIds = leaves.map(l => l.task.id)
  const allOn = allTaskIds.length > 0 && unit && allTaskIds.every(id => isLinked(links, id, unit.id))
  const multiCount = checkedUnits.size
  const tasksPanel = (
    <div style={panel}>
      <ManualTaskAdder lots={lots} onCreate={(lot, title) => addManualTask(lot, title, unit?.id)} />
      {!unit && <div style={hint}>Choisissez un bâtiment, un niveau, un logement ou une zone à gauche pour lui rattacher des tâches.</div>}
      {unit && (
        <>
          <div style={panelHead}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{unitPath(units, unit.id)}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ flex: 1, fontSize: '14px', color: 'var(--navy)' }}>Tâches concernées</strong>
              {multiCount > 1 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#018ABE', background: '#e0f2fe', borderRadius: '6px', padding: '2px 8px' }}>
                  {multiCount} logements sélectionnés
                </span>
              )}
              {allTaskIds.length > 0 && (
                <button onClick={() => setLinksFor(allTaskIds, unit.id, !allOn)} style={selAllBtn}>
                  {allOn ? 'Tout décocher' : 'Tout cocher'}
                </button>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {multiCount > 1
                ? `Les modifications s'appliquent aux ${multiCount} logements cochés.`
                : "Une tâche cochée sur un bâtiment vaut pour tous les logements qu'il contient."}
            </div>
          </div>
          {leaves.length === 0 && <div style={hint}>Aucune tâche au planning pour l'instant.</div>}
          {lots.map(lot => {
            const kids = lot.children ?? []
            if (kids.length === 0) return null
            const ids = kids.map(k => k.id)
            const lotOn = ids.every(id => isLinked(links, id, unit.id))
            return (
              <div key={lot.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ ...groupTitle, flex: 1 }}>{lot.title}</div>
                  <button onClick={() => setLinksFor(ids, unit.id, !lotOn)} style={selAllBtn}>
                    {lotOn ? 'décocher' : 'cocher'} le lot
                  </button>
                </div>
                {kids.map(t => (
                  <label key={t.id} style={checkRow}>
                    <input type="checkbox" checked={isLinked(links, t.id, unit.id)}
                      onChange={() => flip(t.id, unit.id)} style={checkbox} />
                    <span style={{ flex: 1 }}>{t.title}</span>
                  </label>
                ))}
              </div>
            )
          })}
        </>
      )}
    </div>
  )

  const zonesPanel = (
    <div style={panel}>
      {!task && <div style={hint}>Choisissez une tâche à gauche pour désigner les bâtiments, logements ou zones qu'elle concerne.</div>}
      {task && (
        <>
          <div style={panelHead}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{task.lot.title}</div>
            <strong style={{ fontSize: '14px', color: 'var(--navy)' }}>{task.task.title}</strong>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Zones concernées — {unitIdsForTask(links, task.task.id).length} rattachement(s).
            </div>
          </div>
          {units.length === 0 && <div style={hint}>Aucun bâtiment n'est encore décrit.</div>}
          {renderZoneChecks(roots(units), 0, task.task)}
        </>
      )}
    </div>
  )

  function renderOverviewUnit(unit: Unit, depth: number): React.ReactNode {
    const kids = childrenOf(units, unit.id)
    const Icon = KIND_ICON[unit.kind]
    const open = expanded.has(unit.id)
    const stats = taskStatsForUnit(unit.id)
    const openRes = openReservesForUnit(unit.id)

    return (
      <div key={unit.id}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 8px', paddingLeft: `${8 + depth * 16}px`,
          borderRadius: '8px', marginBottom: '2px',
        }}>
          <button
            onClick={() => kids.length && toggleExpand(unit.id)}
            style={{ ...iconBtn, visibility: kids.length ? 'visible' : 'hidden' }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <Icon size={15} style={{ color: 'var(--navy)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--navy)' }}>
            {unit.name}
            {unit.code && <span style={{ fontSize: '11px', color: 'var(--muted)' }}> · {unit.code}</span>}
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}> {UNIT_KIND_LABEL[unit.kind]}</span>
          </span>
          {stats && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <div style={{ width: '64px', height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stats.avg}%`, borderRadius: '3px', background: stats.avg === 100 ? '#10b981' : 'var(--accent)' }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: stats.avg === 100 ? '#10b981' : 'var(--accent)', minWidth: '28px', textAlign: 'right' }}>
                {stats.avg}%
              </span>
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{stats.count} tâche{stats.count > 1 ? 's' : ''}</span>
            </div>
          )}
          {openRes > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', background: '#fff7ed', borderRadius: '6px', padding: '2px 6px', flexShrink: 0 }}>
              {openRes} réserve{openRes > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {stats && open && (
          <div style={{ marginLeft: `${8 + (depth + 1) * 16}px`, marginBottom: '4px' }}>
            {stats.tasks.map(l => (
              <div key={l.task.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', fontSize: '12px', color: 'var(--navy)', borderLeft: '2px solid var(--line)', marginBottom: '2px', borderRadius: '0 4px 4px 0' }}>
                <span style={{ flex: 1, color: 'var(--muted)' }}>{l.lot.title} › {l.task.title}</span>
                <span style={{ fontWeight: 700, color: l.task.progress === 100 ? '#10b981' : 'var(--accent)', minWidth: '32px', textAlign: 'right', fontSize: '11px' }}>
                  {l.task.progress}%
                </span>
              </div>
            ))}
          </div>
        )}
        {open && kids.map(c => renderOverviewUnit(c, depth + 1))}
      </div>
    )
  }

  function renderZoneChecks(list: Unit[], depth: number, t: GanttTask): React.ReactNode {
    return list.map(unitItem => {
      const Icon = KIND_ICON[unitItem.kind]
      return (
        <div key={unitItem.id}>
          <label style={{ ...checkRow, paddingLeft: `${8 + depth * 16}px` }}>
            <input type="checkbox" checked={isLinked(links, t.id, unitItem.id)}
              onChange={() => flip(t.id, unitItem.id)} style={checkbox} />
            <Icon size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              {unitItem.name}
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}> · {UNIT_KIND_LABEL[unitItem.kind]}</span>
            </span>
          </label>
          {renderZoneChecks(childrenOf(units, unitItem.id), depth + 1, t)}
        </div>
      )
    })
  }

  return (
    <div style={{ padding: '14px', paddingBottom: '80px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#eef2f6', padding: '3px', borderRadius: '8px', flex: '0 1 420px' }}>
        {([['zones', 'Par bâtiment / zone'], ['taches', 'Par tâche'], ['vue', 'Vue d\'ensemble']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} style={{
            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', background: mode === id ? '#fff' : 'transparent',
            color: mode === id ? '#02457A' : '#5b7183',
            boxShadow: mode === id ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
          }}>{label}</button>
        ))}
        </div>
        <SavedIndicator watch={savedSignature} />
      </div>

      {/* Formulaire de création / renommage */}
      {form && (
        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '13px', marginBottom: '14px', background: '#fff', maxWidth: '620px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ flex: 1, fontSize: '14px', color: 'var(--navy)' }}>
              {form.editing
                ? `Renommer — ${UNIT_KIND_LABEL[form.kind].toLowerCase()}`
                : `Nouveau — ${UNIT_KIND_LABEL[form.kind].toLowerCase()}`}
              {form.parentId && !form.editing && (
                <span style={{ fontWeight: 400, color: 'var(--muted)' }}> dans {unitPath(units, form.parentId)}</span>
              )}
            </strong>
            <button onClick={() => setForm(null)} style={iconBtn}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input autoFocus value={form.name} placeholder={placeholderFor(form.kind)}
              onChange={e => setForm({ ...form, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              style={{ ...inp, flex: '2 1 220px' }} />
            <input value={form.code ?? ''} placeholder="Code (facultatif)"
              onChange={e => setForm({ ...form, code: e.target.value })}
              style={{ ...inp, flex: '1 1 120px' }} />
            <button onClick={submit} style={primaryBtn}>{form.editing ? 'Enregistrer' : 'Créer'}</button>
          </div>
          {error && <div style={{ fontSize: '12px', color: '#b42318', marginTop: '8px' }}>{UNIT_ERROR_LABEL[error]}</div>}
        </div>
      )}

      {mode === 'vue' && (
        <div style={{ ...panel, padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <strong style={{ flex: 1, fontSize: '14px', color: 'var(--navy)' }}>Vue d'ensemble — Bâtiments et avancement</strong>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {links.length} rattachement{links.length > 1 ? 's' : ''} · {reserves.filter(r => r.status === 'open').length} réserve{reserves.filter(r => r.status === 'open').length > 1 ? 's' : ''} ouverte{reserves.filter(r => r.status === 'open').length > 1 ? 's' : ''}
            </span>
          </div>
          {units.length === 0 && <div style={hint}>Aucun bâtiment. Passez en mode « Par bâtiment / zone » pour décrire la structure.</div>}
          {roots(units).map(u => renderOverviewUnit(u, 0))}
        </div>
      )}

      <div style={{ display: mode === 'vue' ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', alignItems: 'start' }}>
        {/* Colonne de gauche : l'entrée choisie par l'utilisateur */}
        <div style={{ ...panel, padding: '10px' }}>
          {mode === 'zones' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <strong style={{ flex: 1, fontSize: '14px', color: 'var(--navy)' }}>Structure</strong>
                {ALLOWED_CHILDREN.root.map(kind => (
                  <button key={kind} onClick={() => startCreate(undefined, kind)} style={smallBtn}>
                    <Plus size={13} /> {UNIT_KIND_LABEL[kind]}
                  </button>
                ))}
              </div>
              {units.length === 0 && (
                <div style={hint}>
                  Aucun bâtiment. Créez un bâtiment, puis ses niveaux, ses logements et ses parties
                  communes — en précisant à chaque fois de quoi il s'agit.
                </div>
              )}
              {roots(units).map(u => renderUnit(u, 0))}
            </>
          ) : (
            <>
              <strong style={{ fontSize: '14px', color: 'var(--navy)', display: 'block', marginBottom: '10px' }}>
                Tâches du planning
              </strong>
              {leaves.length === 0 && <div style={hint}>Aucune tâche au planning pour l'instant.</div>}
              {lots.map(lot => {
                const kids = lot.children ?? []
                if (kids.length === 0) return null
                return (
                  <div key={lot.id} style={{ marginBottom: '10px' }}>
                    <div style={groupTitle}>{lot.title}</div>
                    {kids.map(t => {
                      const n = unitIdsForTask(links, t.id).length
                      const on = selectedTask === t.id
                      return (
                        <button key={t.id} onClick={() => setSelectedTask(t.id)} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
                          padding: '7px 8px', borderRadius: '8px', marginBottom: '2px', cursor: 'pointer',
                          fontSize: '13px', color: 'var(--navy)',
                          background: on ? 'var(--sky-soft)' : 'transparent',
                          border: on ? '1px solid var(--accent)' : '1px solid transparent',
                          fontWeight: on ? 700 : 400,
                        }}>
                          <span style={{ flex: 1 }}>{t.title}</span>
                          {n > 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>{n} zone{n > 1 ? 's' : ''}</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Colonne de droite : ce qu'on rattache */}
        {mode === 'zones' ? tasksPanel : zonesPanel}
      </div>
    </div>
  )
}

function placeholderFor(kind: UnitKind): string {
  switch (kind) {
    case 'building': return 'Bâtiment A'
    case 'level': return 'R+1'
    case 'dwelling': return 'Logement 3'
    case 'common': return 'Hall d’entrée'
    case 'exterior': return 'Cour intérieure'
  }
}

/** Saisie manuelle d'une tâche, rattachée à un lot puis (via les cases) aux zones. */
function ManualTaskAdder({ lots, onCreate }: { lots: GanttTask[]; onCreate: (lot: GanttTask, title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [lotId, setLotId] = useState(lots[0]?.id ?? '')
  const [title, setTitle] = useState('')
  if (lots.length === 0) return null
  const create = () => {
    const lot = lots.find(l => l.id === lotId)
    if (!lot || !title.trim()) return
    onCreate(lot, title)
    setTitle(''); setOpen(false)
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...smallBtn, marginBottom: '10px' }}>
        <Plus size={13} /> Nouvelle tâche
      </button>
    )
  }
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '10px', marginBottom: '10px', background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ flex: 1, fontSize: '13px', color: 'var(--navy)' }}>Nouvelle tâche</strong>
        <button onClick={() => setOpen(false)} style={iconBtn}><X size={15} /></button>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select value={lotId} onChange={e => setLotId(e.target.value)} style={{ ...inp, flex: '1 1 130px' }}>
          {lots.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <input autoFocus value={title} placeholder="Intitulé de la tâche"
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') create() }}
          style={{ ...inp, flex: '2 1 180px' }} />
        <button onClick={create} style={primaryBtn}>Ajouter</button>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
        Datée sur aujourd'hui (5 j) par défaut — ajustable dans le planning. Cochez ci-dessous les zones concernées.
      </div>
    </div>
  )
}

const selAllBtn: React.CSSProperties = { padding: '4px 9px', borderRadius: '7px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }
const panel: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: '12px', background: '#fff', padding: '12px' }
const panelHead: React.CSSProperties = { borderBottom: '1px solid var(--line)', paddingBottom: '8px', marginBottom: '10px' }
const hint: React.CSSProperties = { fontSize: '12px', color: 'var(--muted)', padding: '14px 4px', lineHeight: 1.5 }
const groupTitle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px 2px' }
const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--navy)' }
const checkbox: React.CSSProperties = { width: '15px', height: '15px', flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }
const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '3px', border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '3px 4px', borderRadius: '6px' }
const smallBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '7px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }
const menuBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }
const primaryBtn: React.CSSProperties = { padding: '8px 15px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }
const dangerBtn: React.CSSProperties = { padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#b42318', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { padding: '5px 9px', borderRadius: '7px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', cursor: 'pointer' }
const confirmBox: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 10px', margin: '0 0 6px', borderRadius: '8px', border: '1px solid #f3c9c4', background: '#fdecec' }
const inp: React.CSSProperties = { padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }
