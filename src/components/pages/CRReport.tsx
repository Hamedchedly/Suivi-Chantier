import { ArrowLeft, Download } from 'lucide-react'
import { getGanttTasks, getReserves } from '../../lib/repo'
import { countOpen } from '../../lib/reserves'
import { overallProgress, lotSummaries, lateTasks, maxDrift } from '../../lib/schedule'
import { LOGEMENTS } from '../../data/zones'

interface CRReportProps {
  number: number
  onBack: () => void
}

const PROJECT = {
  name: 'Gambetta — Réhabilitation',
  ref: 'GAM-2026-001',
  address: '111 Rue Gambetta, 51100 Reims',
  moa: 'Ville de Reims',
  moe: 'Bureau d\'Études ABC',
}

const logementLabel = (id: string) => LOGEMENTS.find(l => l.id === id)?.label ?? id

export function CRReport({ number, onBack }: CRReportProps) {
  const today = new Date()
  const tasks = getGanttTasks()
  const reserves = getReserves()
  const openReserves = reserves.filter(r => r.status === 'open')

  const progress = overallProgress(tasks)
  const lots = lotSummaries(tasks, today)
  const late = lateTasks(tasks, today)
  const drift = maxDrift(tasks)

  return (
    <div>
      {/* Toolbar (not printed) */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--line)', background: '#fff', position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: 'var(--navy-2)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--navy)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <Download size={15} /> Exporter PDF
        </button>
      </div>

      {/* Printable report */}
      <div className="cr-print" style={{ padding: '20px', maxWidth: '780px', margin: '0 auto', background: '#fff', color: '#16222e' }}>
        <div style={{ borderBottom: '2px solid #02457A', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', color: '#018ABE', fontWeight: 700 }}>Compte-rendu de chantier</div>
          <h1 style={{ margin: '4px 0', fontSize: '22px', color: '#02457A' }}>CR N°{number} — {PROJECT.name}</h1>
          <div style={{ fontSize: '12px', color: '#5b7183' }}>
            Réf. {PROJECT.ref} • {PROJECT.address} • {today.toLocaleDateString('fr')}
          </div>
          <div style={{ fontSize: '12px', color: '#5b7183', marginTop: '2px' }}>
            MOA : {PROJECT.moa} — MOE : {PROJECT.moe}
          </div>
        </div>

        {/* KPIs */}
        <Section title="1. Avancement général">
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <Kpi label="Avancement global" value={`${progress}%`} />
            <Kpi label="Dérive max" value={`+${drift} j`} accent={drift > 0} />
            <Kpi label="Tâches en retard" value={String(late.length)} accent={late.length > 0} />
            <Kpi label="Réserves ouvertes" value={String(countOpen(reserves))} accent={countOpen(reserves) > 0} />
          </div>
        </Section>

        {/* Avancement par lot */}
        <Section title="2. Avancement par lot">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Lot</th>
                <th style={thStyle}>Avancement</th>
                <th style={thStyle}>Dérive</th>
                <th style={thStyle}>État</th>
              </tr>
            </thead>
            <tbody>
              {lots.map(l => (
                <tr key={l.lotId}>
                  <td style={tdStyle}>{l.title.replace(/^LOT \d+ - /, '')}</td>
                  <td style={tdStyle}>{l.progress}%</td>
                  <td style={{ ...tdStyle, color: l.drift > 0 ? '#dc2626' : '#15803d' }}>{l.drift > 0 ? `+${l.drift} j` : 'à jour'}</td>
                  <td style={tdStyle}>{l.late ? '⚠ Retard' : '✓ OK'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Retards */}
        <Section title="3. Points de vigilance / retards">
          {late.length === 0 ? (
            <p style={pStyle}>Aucune tâche en retard à ce jour.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {late.map(t => (
                <li key={t.id} style={{ fontSize: '12px', marginBottom: '3px' }}>
                  {t.title} — échéance {t.planned_end.toLocaleDateString('fr')} ({t.progress}%)
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Réserves */}
        <Section title="4. Réserves ouvertes">
          {openReserves.length === 0 ? (
            <p style={pStyle}>Aucune réserve ouverte.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>N°</th>
                  <th style={thStyle}>Localisation</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Priorité</th>
                </tr>
              </thead>
              <tbody>
                {openReserves.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.number}</td>
                    <td style={tdStyle}>{logementLabel(r.logementId)}</td>
                    <td style={tdStyle}>{r.description}</td>
                    <td style={tdStyle}>{r.priority === 'high' ? 'Haute' : r.priority === 'medium' ? 'Moyenne' : 'Faible'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="5. Prochaine réunion">
          <p style={pStyle}>
            À planifier — semaine du {new Date(today.getTime() + 7 * 86400000).toLocaleDateString('fr')}.
          </p>
        </Section>

        <div style={{ marginTop: '24px', paddingTop: '10px', borderTop: '1px solid #e4ecf2', fontSize: '10px', color: '#9bb0c2', textAlign: 'center' }}>
          Document généré automatiquement par Suivi-Chantier — {today.toLocaleDateString('fr')}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <h2 style={{ fontSize: '14px', color: '#02457A', borderBottom: '1px solid #e4ecf2', paddingBottom: '4px', marginBottom: '8px' }}>{title}</h2>
      {children}
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#5b7183', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: accent ? '#dc2626' : '#02457A' }}>{value}</div>
    </div>
  )
}

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', background: '#f8fafc', borderBottom: '1px solid #e4ecf2', color: '#02457A', fontSize: '11px' }
const tdStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #eef2f6' }
const pStyle: React.CSSProperties = { fontSize: '12px', color: '#5b7183', margin: 0 }
