import {
  Play, AlertTriangle, CalendarClock, MapPin, ClipboardCheck, Clock,
  BarChart3, Flag, Building2, FileText, FolderOpen, ChevronRight,
} from 'lucide-react'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import type { Page } from '../../App'
import {
  getGanttTasks, getReserves, getMarches, getAvenants, getSituations, getVisits, getCommitments,
} from '../../lib/repo'
import {
  overallProgress, maxDrift, lateTasks, tasksForToday, lotSummaries, driftDays,
} from '../../lib/schedule'
import { projectFinance, euros } from '../../lib/finance'
import { isOverdue, reserveKind } from '../../lib/reserves'
import { VISIT_KIND_LABEL, visitWorksProgress, progressGap } from '../../lib/visits'
import { LOGEMENTS } from '../../data/zones'

interface HomeProps {
  onNavigate: (page: Page) => void
}

const logementLabel = (id?: string) => (id ? LOGEMENTS.find(l => l.id === id)?.label ?? id : '')
const fmtFr = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso }
const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }) : null
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}` }

export function Home({ onNavigate }: HomeProps) {
  const today = new Date()
  const tasks = getGanttTasks()
  const reserves = getReserves()

  const progress = overallProgress(tasks)
  const drift = maxDrift(tasks)
  const late = lateTasks(tasks, today)
  const todo = tasksForToday(tasks, today)
  const lots = lotSummaries(tasks, today)
  const openReserves = reserves.filter(r => r.status === 'open')
  const highReserves = openReserves.filter(r => r.priority === 'high')
  const pf = projectFinance(getMarches(), getAvenants(), getSituations())
  const lotsOnTrack = lots.filter(l => !l.late).length

  // ── Visit pilot: what the last tour found, and what is still owed ─────────
  const now = todayIso()
  const visits = getVisits()
  const running = visits.find(v => v.status === 'en_cours')
  const lastClosed = visits.filter(v => v.status !== 'en_cours').sort((a, b) => b.date.localeCompare(a.date))[0]
  const commitments = getCommitments()
  const overdueActions = openReserves.filter(r => reserveKind(r) === 'action' && isOverdue(r, now))
  const brokenCommitments = commitments.filter(c => (c.outcome ?? 'pending') !== 'kept' && c.promisedEnd < now)
  const toCheck = openReserves.filter(r => r.visitId)

  const observedGaps = lastClosed
    ? lastClosed.zones.flatMap(z => z.tasks.map(progressGap)).filter((g): g is number => g !== null)
    : []
  const avgGap = observedGaps.length
    ? Math.round(observedGaps.reduce((s, g) => s + g, 0) / observedGaps.length)
    : null

  const risks = [
    ...late.map(t => ({ key: `late-${t.id}`, label: `${t.title} en retard`, sub: `échéance ${t.planned_end.toLocaleDateString('fr')}` })),
    ...lots.filter(l => l.drift > 0).map(l => ({ key: `drift-${l.lotId}`, label: `${l.title.replace(/^LOT \d+ - /, '')} : +${l.drift} j de dérive`, sub: 'vs planning contractuel' })),
    ...highReserves.map(r => ({ key: `res-${r.id}`, label: `${r.number} — ${r.description}`, sub: `${logementLabel(r.logementId)} • priorité haute` })),
  ]

  return (
    <div style={{ padding: '16px 12px', paddingBottom: '16px' }}>
      {/* Hero — avancement gauge */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '16px 18px' }}>
        <div style={{ width: '120px', height: '120px', flexShrink: 0, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: progress }]} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" background={{ fill: '#D6E8EE' }} cornerRadius={10} fill="#018ABE" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>{progress}%</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>avancement</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <HeroStat label="Lots à jour" value={`${lotsOnTrack} / ${lots.length}`} tone={lotsOnTrack === lots.length ? 'ok' : 'warn'} />
          <HeroStat label="Budget facturé" value={`${pf.billedPct}%`} sub={euros(pf.billed)} />
          <HeroStat label="Réserves ouvertes" value={String(openReserves.length)} tone={openReserves.length ? 'warn' : 'ok'} />
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard label="Avancement" value={`${progress}%`} variant="ok" />
        <KPICard label="Dérive max" value={`+${drift} j`} variant={drift > 0 ? 'warn' : undefined} />
        <KPICard label="Retards" value={late.length} variant={late.length > 0 ? 'warn' : undefined} />
        <KPICard label="Réserves" value={openReserves.length} variant={openReserves.length > 0 ? 'warn' : undefined} />
      </div>

      {/* Visites — pilotage */}
      <section>
        <h2 className="section-title"><ClipboardCheck size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Visites</h2>

        {running ? (
          <button onClick={() => onNavigate('visite')} style={{ ...rowCard, borderLeft: '3px solid var(--navy-2)', marginBottom: '8px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                {VISIT_KIND_LABEL[running.kind]} en cours
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Clock size={11} />
                {fmtTime(running.startedAt) ? `démarrée à ${fmtTime(running.startedAt)} • ` : ''}{fmtFr(running.date)}
              </div>
            </div>
            <ChevronRight size={15} color="var(--muted)" />
          </button>
        ) : lastClosed ? (
          <button onClick={() => onNavigate('visite')} style={{ ...rowCard, marginBottom: '8px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                Dernière visite — {fmtFr(lastClosed.date)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                Travaux constatés {visitWorksProgress(lastClosed)}%
                {avgGap !== null && avgGap !== 0 && (
                  <span style={{ color: avgGap < 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 700 }}>
                    {' '}• écart {avgGap > 0 ? `+${avgGap}` : avgGap} pts vs planning
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={15} color="var(--muted)" />
          </button>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
          <AlertCount n={overdueActions.length} label="actions en retard" tone="bad" onClick={() => onNavigate('cr')} />
          <AlertCount n={brokenCommitments.length} label="engagements non tenus" tone="warn" onClick={() => onNavigate('visite')} />
          <AlertCount n={toCheck.length} label="points à vérifier" tone="mid" onClick={() => onNavigate('cr')} />
        </div>

        <button className="btn-primary" onClick={() => onNavigate('visite')}>
          <Play size={16} />
          {running ? 'Reprendre la visite' : 'Nouvelle visite de chantier'}
        </button>
      </section>

      {/* Raccourcis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '8px', marginBottom: '20px' }}>
        <Shortcut icon={<BarChart3 size={16} />} label="Planning" onClick={() => onNavigate('gantt')} />
        <Shortcut icon={<Flag size={16} />} label="Actions" onClick={() => onNavigate('cr')} />
        <Shortcut icon={<Building2 size={16} />} label="Entreprises" onClick={() => onNavigate('config')} />
        <Shortcut icon={<FileText size={16} />} label="Rapports" onClick={() => onNavigate('rapports')} />
        <Shortcut icon={<FolderOpen size={16} />} label="Finances" onClick={() => onNavigate('finances')} />
      </div>

      {/* À faire aujourd'hui */}
      <section>
        <h2 className="section-title"><CalendarClock size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />À faire aujourd'hui</h2>
        {todo.length === 0 ? (
          <div className="card" style={{ fontSize: '13px', color: 'var(--muted)' }}>Aucune tâche active aujourd'hui.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todo.map(t => (
              <button key={t.id} onClick={() => onNavigate('gantt')} style={rowCard}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <MapPin size={11} /> {logementLabel(t.logement_id)} • {t.progress}%{driftDays(t) > 0 ? ` • +${driftDays(t)} j` : ''}
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: t.status === 'delayed' || t.status === 'blocked' ? 'var(--bad)' : 'var(--navy-2)' }}>{t.progress}%</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Risques chantier */}
      <section>
        <h2 className="section-title"><AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Risques chantier</h2>
        {risks.length === 0 ? (
          <div className="card" style={{ fontSize: '13px', color: 'var(--ok)' }}>Aucun risque identifié. 👍</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {risks.slice(0, 6).map(r => (
              <div key={r.key} style={{ display: 'flex', gap: '10px', alignItems: 'start', background: '#fff', border: '1px solid var(--line)', borderLeft: '3px solid var(--bad)', borderRadius: '8px', padding: '10px 12px' }}>
                <AlertTriangle size={16} color="var(--bad)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{r.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lots */}
      <section>
        <h2 className="section-title">Lots</h2>
        <div>
          {lots.map(lot => (
            <div key={lot.lotId} className="lot-card">
              <div className="lot-header">
                <div>
                  <div className="lot-name">{lot.lotId}</div>
                  <div className="lot-desc">{lot.title.replace(/^LOT \d+ - /, '')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="lot-progress">{lot.progress}%</div>
                  <div className={`lot-status ${lot.late ? 'late' : 'ok'}`}>{lot.late ? 'Retard' : 'À jour'}</div>
                </div>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${lot.late ? 'late' : ''}`} style={{ width: `${lot.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function HeroStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--bad)' : 'var(--navy)'
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: '15px', fontWeight: 700, color }}>
        {value}{sub && <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginLeft: '5px' }}>{sub}</span>}
      </span>
    </div>
  )
}

function AlertCount({ n, label, tone, onClick }: { n: number; label: string; tone: 'bad' | 'warn' | 'mid'; onClick: () => void }) {
  const color = n === 0 ? 'var(--muted)' : tone === 'bad' ? '#dc2626' : tone === 'warn' ? '#ea580c' : '#b45309'
  const bg = n === 0 ? '#f8fafc' : tone === 'bad' ? '#fdecec' : tone === 'warn' ? '#fff2e8' : '#fef3c7'
  return (
    <button onClick={onClick} style={{ padding: '10px 8px', borderRadius: '10px', border: '1px solid var(--line)', background: bg, cursor: 'pointer', textAlign: 'center' }}>
      <div style={{ fontSize: '20px', fontWeight: 800, color, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>{label}</div>
    </button>
  )
}

function Shortcut({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '12px 6px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', color: 'var(--navy)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
      {icon}
      {label}
    </button>
  )
}

function KPICard({ label, value, variant }: { label: string; value: string | number; variant?: 'ok' | 'warn' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${variant || ''}`}>{value}</div>
    </div>
  )
}

const rowCard: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', width: '100%', background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer' }
