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
    <div className="w-full px-3 sm:px-6 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0b3b60] mb-1">{MOCK_DATA.project.name}</h1>
        <p className="text-sm text-[#5c6f80]">Ref. GAM-2026-001 • {MOCK_DATA.project.addr}</p>
      </div>

      {/* KPIs Grid - Responsive 2x2 → 4 cols */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KPICard label="Avancement" value={`${avgProgress}%`} variant="ok" />
        <KPICard label="Retard max" value={`+${maxDelay} j`} variant="warn" />
        <KPICard label="Lots en retard" value={lateCount} variant="warn" />
        <KPICard label="Visites" value="0" variant="neutral" />
      </div>

      {/* Action Button */}
      <button className="w-full sm:w-auto bg-[#0b3b60] text-white px-4 py-3 sm:py-2 rounded-lg font-medium flex items-center justify-center gap-2 mb-6 hover:bg-[#185FA5] transition">
        <Play size={16} />
        Nouvelle visite de chantier
      </button>

      {/* Lots Section */}
      <section className="mb-6">
        <h2 className="text-xs sm:text-sm font-bold text-[#5c6f80] uppercase tracking-wider mb-4">Lots</h2>
        <div className="space-y-3">
          {MOCK_DATA.lots.map(lot => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </div>
      </section>

      {/* Rhythm Section */}
      <section>
        <h2 className="text-xs sm:text-sm font-bold text-[#5c6f80] uppercase tracking-wider mb-4">Rythme entreprises</h2>
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-4">
          <div className="space-y-3">
            {MOCK_DATA.companies.map(co => (
              <div key={co.name} className="flex items-center gap-3">
                <div className="text-sm text-[#5c6f80] min-w-max max-w-[120px] truncate">{co.name}</div>
                <div className="flex-1 h-3 bg-[#e6edf3] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#185FA5] rounded-full"
                    style={{ width: `${(co.rate / maxCompanyRate) * 100}%` }}
                  />
                </div>
                <div className="text-sm font-medium text-[#0b3b60] min-w-max">+{co.rate}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function KPICard({ label, value, variant }: { label: string; value: string | number; variant: 'ok' | 'warn' | 'neutral' }) {
  const colors = {
    ok: 'text-[#15803d]',
    warn: 'text-[#b91c1c]',
    neutral: 'text-[#0b3b60]',
  }

  return (
    <div className="bg-white rounded-lg p-3 sm:p-4 border border-[#e3e9ee]">
      <p className="text-xs text-[#5c6f80] uppercase font-medium mb-2">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold ${colors[variant]}`}>{value}</p>
    </div>
  )
}

function LotCard({ lot }: { lot: (typeof MOCK_DATA.lots)[0] }) {
  return (
    <div className="bg-white rounded-lg p-3 sm:p-4 border border-[#e3e9ee] cursor-pointer hover:border-[#185FA5] transition">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-[#0b3b60] text-sm sm:text-base">{lot.short}</p>
          <p className="text-xs sm:text-sm text-[#5c6f80]">{lot.name}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-[#185FA5] text-lg sm:text-2xl">{lot.progress}%</p>
          <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
            lot.status === 'ok' ? 'bg-[#e9f7ee] text-[#15803d]' : 'bg-[#fdecec] text-[#b91c1c]'
          }`}>
            {lot.status === 'ok' ? 'À jour' : 'Retard'}
          </span>
        </div>
      </div>
      {/* Progress Bar */}
      <div className="h-2 bg-[#e6edf3] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            lot.status === 'ok' ? 'bg-[#185FA5]' : 'bg-[#b91c1c]'
          }`}
          style={{ width: `${lot.progress}%` }}
        />
      </div>
    </div>
  )
}
