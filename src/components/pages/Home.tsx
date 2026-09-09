import { Play } from 'lucide-react'

const MOCK_DATA = {
  project: { name: 'Gambetta — Réhabilitation', addr: '111 Rue Gambetta, 51100 Reims' },
  lots: [
    { id: 'L05', short: 'LOT 05', name: 'Menuiseries int. / Isolation', progress: 82, status: 'ok' as const },
    { id: 'L06', short: 'LOT 06', name: 'Électricité / Contrôle accès', progress: 64, status: 'ok' as const },
    { id: 'L07', short: 'LOT 07', name: 'CVC', progress: 51, status: 'late' as const },
    { id: 'L08', short: 'LOT 08', name: 'Embellissements', progress: 32, status: 'ok' as const },
  ],
  companies: [
    { name: 'SMP Aménagement', rate: 15 },
    { name: 'Soveclim Services', rate: 12 },
    { name: 'Soretherm', rate: 18 },
  ],
}

export function Home() {
  const avgProgress = Math.round(MOCK_DATA.lots.reduce((a, l) => a + l.progress, 0) / MOCK_DATA.lots.length)
  const maxDelay = 4
  const lateCount = MOCK_DATA.lots.filter(l => l.status === 'late').length
  const maxCompanyRate = Math.max(...MOCK_DATA.companies.map(c => c.rate))

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0b3b60', marginBottom: '4px' }}>
          {MOCK_DATA.project.name}
        </h1>
        <p style={{ fontSize: '14px', color: '#5c6f80' }}>
          Ref. GAM-2026-001 • {MOCK_DATA.project.addr}
        </p>
      </div>

      {/* KPIs Grid */}
      <div className="kpi-grid">
        <KPICard label="Avancement" value={`${avgProgress}%`} variant="ok" />
        <KPICard label="Retard max" value={`+${maxDelay} j`} variant="warn" />
        <KPICard label="Lots en retard" value={lateCount} variant="warn" />
        <KPICard label="Visites" value="0" />
      </div>

      {/* Action Button */}
      <button className="btn-primary">
        <Play size={16} />
        Nouvelle visite de chantier
      </button>

      {/* Lots Section */}
      <section>
        <h2 className="section-title">Lots</h2>
        <div>
          {MOCK_DATA.lots.map(lot => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </div>
      </section>

      {/* Rhythm Section */}
      <section>
        <h2 className="section-title">Rythme entreprises</h2>
        <div className="card">
          {MOCK_DATA.companies.map(co => (
            <div key={co.name} className="rhythm-item">
              <div className="rhythm-name">{co.name}</div>
              <div className="rhythm-bar">
                <div
                  className="rhythm-fill"
                  style={{ width: `${(co.rate / maxCompanyRate) * 100}%` }}
                />
              </div>
              <div className="rhythm-pct">+{co.rate}%</div>
            </div>
          ))}
        </div>
      </section>
    </div>
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

function LotCard({ lot }: { lot: (typeof MOCK_DATA.lots)[0] }) {
  return (
    <div className="lot-card">
      <div className="lot-header">
        <div>
          <div className="lot-name">{lot.short}</div>
          <div className="lot-desc">{lot.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="lot-progress">{lot.progress}%</div>
          <div className={`lot-status ${lot.status}`}>{lot.status === 'ok' ? 'À jour' : 'Retard'}</div>
        </div>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-fill ${lot.status === 'late' ? 'late' : ''}`}
          style={{ width: `${lot.progress}%` }}
        />
      </div>
    </div>
  )
}
