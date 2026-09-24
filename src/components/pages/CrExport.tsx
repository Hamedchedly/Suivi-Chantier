// ────────────────────────────────────────────────────────────────────────────
// Export CR — sections 13 à 19 du sprint Planning/Journal CR.
//
// Point critique (section 16) : l'aperçu affiché ICI est EXACTEMENT le DOM
// imprimé/exporté — pas un composant Preview séparé d'un composant PDF
// différent. `.cr-print-doc` est la même arborescence dans les deux cas ; le
// média print masque tout le reste (chrome de la modale) via CSS.
// ────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { X, Printer, ChevronUp, ChevronDown } from 'lucide-react'
import { Reserve, getReserveCompanies, getReserveLocations, getReserveLots, isArchivedAt, isNewOrModifiedAt } from '../../lib/reserves'
import {
  getCrExportConfig, saveCrExportConfig, CrExportConfig, CrExportSectionKey, CR_EXPORT_SECTION_LABEL,
  getGanttTasks, getMeetings, getProjects, getCurrentProjectId, getZoneRefs,
} from '../../lib/repo'
import { flattenLeaves } from '../../lib/schedule'
import { computeTimelineRange, xForDate, widthForRange } from '../../lib/planningViewModel'
import { GanttTask } from '../../types/gantt'
import type { ZoneRef } from '../../lib/visits'

interface Props {
  reserves: Reserve[]
  lots: { id: string; name: string; company?: string }[]
  crNumbers: number[]
  zoneRefs?: ZoneRef[]
  onClose: () => void
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const frDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

/** Nom de fichier au format des CR existants : YYMMDD - NOM_OPERATION_CR_NXX (section 17). */
export function filenameFor(opName: string, crNo: number, date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const stamp = `${yy}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
  const safeOp = (opName || 'OPERATION').trim().toUpperCase().replace(/\s+/g, '_')
  return `${stamp} - ${safeOp}_CR_N${String(crNo).padStart(2, '0')}`
}

const mondayOf = (d: Date): Date => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export function CrExport({ reserves, lots, crNumbers, zoneRefs, onClose }: Props) {
  const [crNo, setCrNo] = useState<number>(crNumbers.length ? Math.max(...crNumbers) : 1)
  const [config, setConfig] = useState<CrExportConfig>(getCrExportConfig)

  const project = useMemo(() => getProjects().find(p => p.id === getCurrentProjectId()), [])
  const ganttTasks = useMemo(() => getGanttTasks(), [])
  const meetings = useMemo(() => getMeetings(), [])
  const zoneRefsLocal = useMemo(() => zoneRefs ?? getZoneRefs(), [zoneRefs])

  const toggleSection = (key: CrExportSectionKey) => {
    const next = { ...config, sections: { ...config.sections, [key]: !config.sections[key] } }
    setConfig(next); saveCrExportConfig(next)
  }
  const moveSection = (key: CrExportSectionKey, dir: -1 | 1) => {
    const i = config.order.indexOf(key)
    const j = i + dir
    if (j < 0 || j >= config.order.length) return
    const order = [...config.order]
    ;[order[i], order[j]] = [order[j], order[i]]
    const next = { ...config, order }
    setConfig(next); saveCrExportConfig(next)
  }

  const meetingDate = useMemo(() => {
    const dates = reserves.filter(r => r.crNo === crNo && r.meetingDate).map(r => r.meetingDate!)
    return dates.length ? dates.sort().at(-1) : undefined
  }, [reserves, crNo])

  const meeting = useMemo(() => meetings.find(m => m.date === meetingDate), [meetings, meetingDate])
  const nextMeeting = useMemo(() => {
    if (!meetingDate) return undefined
    return [...meetings].filter(m => m.date > meetingDate).sort((a, b) => a.date.localeCompare(b.date))[0]
  }, [meetings, meetingDate])

  // Fusion des anciennes sections 5+6 (section 14) : tout ce qui n'est pas
  // encore archivé (ouvert, ou clos mais dans sa fenêtre de maintien N/N+1/N+2
  // — isArchivedAt, reserves.ts), jamais tout l'historique.
  const nonTerminees = useMemo(() => reserves.filter(r => !isArchivedAt(r, crNo) && !r.archived), [reserves, crNo])
  const nouvelles = useMemo(() => reserves.filter(r => r.createdCrNo === crNo || r.lastModifiedCrNo === crNo), [reserves, crNo])
  const actions = useMemo(() => nonTerminees.filter(r => (r.kind ?? 'action') === 'action'), [nonTerminees])
  const photos = useMemo(() => reserves.filter(r => (r.crNo === crNo || r.createdCrNo === crNo) && r.photo), [reserves, crNo])

  const weekStart = useMemo(() => mondayOf(meetingDate ? new Date(meetingDate) : new Date()), [meetingDate])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const filename = filenameFor(project?.name ?? 'OPERATION', crNo)

  useEffect(() => {
    const prevTitle = document.title
    const onBeforePrint = () => { document.title = filename }
    const onAfterPrint = () => { document.title = prevTitle }
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
      document.title = prevTitle
    }
  }, [filename])

  const lotLabel = (id: string) => lots.find(l => l.id === id)?.name ?? id
  const zoneLabel = (id: string) => {
    const z = zoneRefsLocal.find(z => z.refId === id)
    return z ? `${z.buildingLabel} — ${z.label}` : id
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 200, display: 'flex' }} className="cr-export-overlay">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .cr-print-doc, .cr-print-doc * { visibility: visible; }
          .cr-print-doc { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; }
          .cr-export-chrome { display: none !important; }
          .cr-page-gantt { break-before: page; page: gantt; }
          .cr-page-portrait-section { page: portrait; }
        }
        @page portrait { size: A4 portrait; margin: 14mm; }
        @page gantt { size: A4 landscape; margin: 10mm; }
      `}</style>

      {/* Panneau de configuration (masqué à l'impression) */}
      <div className="cr-export-chrome" style={{ width: 300, flexShrink: 0, background: '#fff', borderRight: '1px solid var(--line)', padding: 16, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Export du CR</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Compte rendu</label>
        <select value={crNo} onChange={e => setCrNo(Number(e.target.value))} style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, marginBottom: 14 }}>
          {(crNumbers.length ? crNumbers : [crNo]).slice().reverse().map(n => <option key={n} value={n}>CR {n}</option>)}
        </select>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
          Sections (mémorisé pour cette opération)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {config.order.map((key, i) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 6px', borderRadius: 6, background: '#f8fafc' }}>
              <input type="checkbox" checked={config.sections[key]} onChange={() => toggleSection(key)} style={{ accentColor: '#02457A' }} />
              <span style={{ flex: 1, color: 'var(--ink)' }}>{CR_EXPORT_SECTION_LABEL[key]}</span>
              <button disabled={i === 0} onClick={() => moveSection(key, -1)} style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#cbd5e1' : 'var(--muted)', padding: 0 }}><ChevronUp size={13} /></button>
              <button disabled={i === config.order.length - 1} onClick={() => moveSection(key, 1)} style={{ border: 'none', background: 'none', cursor: i === config.order.length - 1 ? 'default' : 'pointer', color: i === config.order.length - 1 ? '#cbd5e1' : 'var(--muted)', padding: 0 }}><ChevronDown size={13} /></button>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>Nom du fichier : <b>{filename}.pdf</b></div>

        <button
          onClick={() => window.print()}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <Printer size={14} /> Exporter en PDF
        </button>
      </div>

      {/* Aperçu = document imprimé (section 16) — même arbre, jamais un composant à part */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="cr-export-chrome">
        <div className="cr-print-doc" style={{ maxWidth: 780, margin: '0 auto', background: '#fff', padding: 28, borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,.18)' }}>
          <div className="cr-page-portrait-section">
            {config.order.filter(k => k !== 'planningSemaine' && config.sections[k]).map(key => (
              <Section key={key} title={CR_EXPORT_SECTION_LABEL[key]}>
                {key === 'infos' && (
                  <InfosGenerales project={project} crNo={crNo} meetingDate={meetingDate} />
                )}
                {key === 'presents' && (
                  meeting?.attendees.length ? <p style={pText}>{meeting.attendees.join(', ')}</p> : <p style={pText}>Non renseigné.</p>
                )}
                {key === 'avancement' && <AvancementParLot ganttTasks={ganttTasks} />}
                {key === 'remarquesOuvertes' && <RemarquesList rows={nonTerminees} crNo={crNo} lotLabel={lotLabel} zoneLabel={zoneLabel} />}
                {key === 'remarquesNouvelles' && (
                  nouvelles.length ? <RemarquesList rows={nouvelles} crNo={crNo} lotLabel={lotLabel} zoneLabel={zoneLabel} /> : <p style={pText}>Aucune nouvelle remarque à ce CR.</p>
                )}
                {key === 'actions' && <ActionsTable rows={actions} lotLabel={lotLabel} zoneLabel={zoneLabel} />}
                {key === 'photos' && <PhotosGrid rows={photos} />}
                {key === 'prochaineReunion' && (
                  nextMeeting ? <p style={pText}><b>{nextMeeting.title}</b> — {frDate(nextMeeting.date)}</p> : <p style={pText}>Non planifiée.</p>
                )}
              </Section>
            ))}
          </div>

          {config.sections.planningSemaine && (
            <div className="cr-page-gantt">
              <PlanningSemaine tasks={ganttTasks} weekStart={weekStart} weekEnd={weekEnd} crNo={crNo} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const pText: React.CSSProperties = { fontSize: 12, color: '#334155', margin: '0 0 6px', lineHeight: 1.5 }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#02457A', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid #02457A', paddingBottom: 4, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function InfosGenerales({ project, crNo, meetingDate }: { project?: { name: string; reference?: string; address?: string; moa?: string; moe?: string }; crNo: number; meetingDate?: string }) {
  const rows: [string, string][] = [
    ['Opération', project?.name ?? '—'],
    ['Référence', project?.reference ?? '—'],
    ['Adresse', project?.address ?? '—'],
    ['MOA', project?.moa ?? '—'],
    ['MOE', project?.moe ?? '—'],
    ['N° de CR', `CR ${crNo}`],
    ['Date', frDate(meetingDate)],
  ]
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={{ padding: '3px 8px 3px 0', color: '#64748b', width: 120 }}>{label}</td>
            <td style={{ padding: '3px 0', color: '#1f2937', fontWeight: 600 }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Section 13 : avancement PAR LOT — directement depuis le planning (task.progress
 * des lots de premier niveau), jamais recalculé spécifiquement pour le CR. */
function AvancementParLot({ ganttTasks }: { ganttTasks: GanttTask[] }) {
  if (ganttTasks.length === 0) return <p style={pText}>Aucun lot planifié.</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <tbody>
        {ganttTasks.map(lot => (
          <tr key={lot.id}>
            <td style={{ padding: '4px 0', color: '#1f2937' }}>{lot.title}</td>
            <td style={{ padding: '4px 0', textAlign: 'right', width: 90 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 60, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ width: `${lot.progress}%`, height: '100%', background: lot.progress >= 100 ? '#15803d' : '#018ABE' }} />
                </div>
                <b style={{ fontSize: 11 }}>{lot.progress}%</b>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RemarquesList({ rows, crNo, lotLabel, zoneLabel }: { rows: Reserve[]; crNo: number; lotLabel: (id: string) => string; zoneLabel: (id: string) => string }) {
  if (rows.length === 0) return <p style={pText}>Aucune remarque.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => {
        const isNewOrMod = isNewOrModifiedAt(r, crNo)
        const lotChips = getReserveLots(r).map(lotLabel)
        const locChips = getReserveLocations(r).map(zoneLabel)
        const companyText = r.allCompanies ? 'Toutes les entreprises' : getReserveCompanies(r).join(', ')
        return (
          <div key={r.id} style={{ fontSize: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 5 }}>
            <div style={{ color: isNewOrMod ? '#018ABE' : '#1f2937', fontWeight: isNewOrMod ? 700 : 500 }}>{r.description}</div>
            <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              {lotChips.length > 0 && <span>{lotChips.join(', ')}</span>}
              {companyText && <span>{companyText}</span>}
              {locChips.length > 0 && <span>{locChips.join(', ')}</span>}
              {r.dueDate && <span>Échéance {frDate(r.dueDate)}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ActionsTable({ rows, lotLabel, zoneLabel }: { rows: Reserve[]; lotLabel: (id: string) => string; zoneLabel: (id: string) => string }) {
  if (rows.length === 0) return <p style={pText}>Aucune action en cours.</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr>
          {['Point', 'Lot', 'Logement', 'Entreprise', 'Échéance'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '4px 6px', background: '#f8fafc', color: '#02457A', fontSize: 10 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>{r.description}</td>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>{getReserveLots(r).map(lotLabel).join(', ') || '—'}</td>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>{getReserveLocations(r).map(zoneLabel).join(', ') || '—'}</td>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>{r.allCompanies ? 'Toutes' : getReserveCompanies(r).join(', ') || '—'}</td>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>{frDate(r.dueDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PhotosGrid({ rows }: { rows: Reserve[] }) {
  if (rows.length === 0) return <p style={pText}>Aucune photo pour ce CR.</p>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {rows.map(r => (
        <figure key={r.id} style={{ margin: 0 }}>
          <img src={r.photo} alt={r.description} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} />
          <figcaption style={{ fontSize: 9, color: '#64748b', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</figcaption>
        </figure>
      ))}
    </div>
  )
}

/**
 * Section 15 : dernière page, PAYSAGE, une seule page — une capture propre de
 * la semaine du CR (lots/tâches pertinents, avancement, contractuel, réel),
 * pas une liste HTML brute. Réutilise la géométrie pure de planningViewModel
 * (xForDate/widthForRange) — jamais un second moteur de positionnement.
 */
function PlanningSemaine({ tasks, weekStart, weekEnd, crNo }: { tasks: GanttTask[]; weekStart: Date; weekEnd: Date; crNo: number }) {
  const scale = useMemo(() => computeTimelineRange([], weekStart, 'week', 90), [weekStart])
  // Recadre strictement sur la semaine du CR (computeTimelineRange étire sur
  // toutes les tâches + aujourd'hui — ici on ne veut QUE cette semaine).
  const weekScale = { ...scale, start: weekStart, end: addDays(weekEnd, 1) }
  const width = (diffDaysLocal(weekScale.end, weekScale.start)) * weekScale.dayWidth

  const rows = useMemo(() => {
    const out: { lot: string; task: GanttTask }[] = []
    for (const lot of tasks) {
      for (const t of flattenLeaves([lot])) {
        if (t.planned_end.getTime() < weekStart.getTime() || t.planned_start.getTime() > weekEnd.getTime()) continue
        out.push({ lot: lot.title, task: t })
      }
    }
    return out
  }, [tasks, weekStart, weekEnd])

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#02457A', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
        Planning de la semaine — CR {crNo} ({frDate(isoOf(weekStart))} → {frDate(isoOf(weekEnd))})
      </div>
      {rows.length === 0 ? (
        <p style={pText}>Aucune tâche planifiée sur cette semaine.</p>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width, minWidth: 500, height: rows.length * 20 + 4, background: '#fff' }}>
            {rows.map((r, i) => {
              const cx = xForDate(r.task.planned_start, weekScale)
              const cw = widthForRange(r.task.planned_start, r.task.planned_end, weekScale)
              const overdue = r.task.progress < 100 && r.task.planned_end.getTime() < weekEnd.getTime()
              return (
                <div key={r.task.id} style={{ position: 'absolute', top: i * 20 + 2, left: 0, width: '100%', height: 16, display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 4, fontSize: 8, color: '#64748b', zIndex: 1, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.lot} · {r.task.title}
                  </span>
                  <div style={{
                    position: 'absolute', left: Math.max(0, cx), width: Math.max(4, cw), height: 10, borderRadius: 2,
                    background: overdue ? '#dc2626' : r.task.progress >= 100 ? '#15803d' : '#018ABE', opacity: 0.85,
                  }} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function diffDaysLocal(a: Date, b: Date): number { return Math.round((a.getTime() - b.getTime()) / 86400000) }
function isoOf(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
