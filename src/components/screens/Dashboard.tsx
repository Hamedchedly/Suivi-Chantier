import { TrendingUp, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'

export function Dashboard() {
  // Mock data
  const operation = {
    name: 'Gambetta — Réhabilitation',
    reference: 'GAM-2026-001',
  }

  const kpis = [
    { label: 'Avancement Global', value: '63%', trend: '+8%', color: 'success' },
    { label: 'Lots À Jour', value: '3', trend: null, color: 'success' },
    { label: 'Lots En Retard', value: '1', trend: null, color: 'warning' },
    { label: 'Points Bloquants', value: '0', trend: null, color: 'info' },
  ]

  const lots = [
    { name: 'LOT 01 — Gros œuvre', progress: 75, status: 'À jour' },
    { name: 'LOT 02 — Façades', progress: 63, status: 'À jour' },
    { name: 'LOT 03 — Fluides', progress: 45, status: 'Retard' },
    { name: 'LOT 04 — Finitions', progress: 20, status: 'À jour' },
  ]

  const timelineData = [
    { week: 'S36', real: 20, planned: 25 },
    { week: 'S37', real: 45, planned: 50 },
    { week: 'S38', real: 60, planned: 70 },
    { week: 'S39', real: 75, planned: 85 },
    { week: 'S40', real: 85, planned: 95 },
  ]

  const alerts = [
    { type: 'delay', text: '2 lots en retard', icon: AlertCircle },
    { type: 'success', text: 'Inspection finalisée', icon: CheckCircle },
    { type: 'warning', text: 'Visite prévue demain', icon: Clock },
  ]

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 mb-6">
        <h2 className="text-2xl font-bold text-[#0b3b60] mb-1">{operation.name}</h2>
        <p className="text-[#5c6f80] text-sm">Ref. {operation.reference}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-lg border border-[#e3e9ee] p-5 shadow-sm"
          >
            <p className="text-xs uppercase font-semibold text-[#5c6f80] mb-2">
              {kpi.label}
            </p>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-bold text-[#0b3b60]">{kpi.value}</p>
              {kpi.trend && (
                <span className="text-xs font-semibold text-[#15803d]">{kpi.trend}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-[#e3e9ee] p-6">
        <h3 className="font-bold text-[#0b3b60] mb-4">Avancement Temporel (S36-S40)</h3>
        <div className="space-y-4">
          {timelineData.map((week) => {
            const maxVal = 100
            const realPct = (week.real / maxVal) * 100
            const plannedPct = (week.planned / maxVal) * 100
            return (
              <div key={week.week}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-[#16222e] text-sm">{week.week}</span>
                  <div className="flex gap-4 text-xs">
                    <span className="text-[#185FA5]">Réel: {week.real}%</span>
                    <span className="text-[#15803d]">Prévu: {week.planned}%</span>
                  </div>
                </div>
                <div className="relative h-6 bg-[#e6edf3] rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-[#0f5a90] to-[#1f8bd2]"
                    style={{ width: `${realPct}%` }}
                  />
                  <div
                    className="absolute h-1 top-1/2 -translate-y-1/2 border-l-2 border-[#15803d]"
                    style={{ left: `${plannedPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lot Progress */}
      <div className="bg-white rounded-lg border border-[#e3e9ee] p-6">
        <h3 className="font-bold text-[#0b3b60] mb-4">Avancement par Lot</h3>
        <div className="space-y-4">
          {lots.map((lot) => (
            <div key={lot.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#16222e] text-sm">{lot.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#185FA5]">{lot.progress}%</span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      lot.status === 'À jour'
                        ? 'bg-[#e9f7ee] text-[#15803d]'
                        : 'bg-[#fdf1e0] text-[#b45309]'
                    }`}
                  >
                    {lot.status}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-[#e6edf3] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    lot.status === 'À jour'
                      ? 'bg-gradient-to-r from-[#15803d] to-[#22c55e]'
                      : 'bg-gradient-to-r from-[#b45309] to-[#f59e0b]'
                  }`}
                  style={{ width: `${lot.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6">
          <h3 className="font-bold text-[#0b3b60] mb-4">Distribution des Statuts</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#16222e]">À jour</span>
                <span className="text-sm font-bold text-[#15803d]">3 lots</span>
              </div>
              <div className="h-3 bg-[#e6edf3] rounded-full overflow-hidden">
                <div className="h-full bg-[#15803d]" style={{ width: '75%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#16222e]">En retard</span>
                <span className="text-sm font-bold text-[#b91c1c]">1 lot</span>
              </div>
              <div className="h-3 bg-[#e6edf3] rounded-full overflow-hidden">
                <div className="h-full bg-[#b91c1c]" style={{ width: '25%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#16222e]">Suspendu</span>
                <span className="text-sm font-bold text-[#c2410c]">0 lot</span>
              </div>
              <div className="h-3 bg-[#e6edf3] rounded-full overflow-hidden">
                <div className="h-full bg-[#c2410c]" style={{ width: '0%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6">
          <h3 className="font-bold text-[#0b3b60] mb-4">Comparaison Planifié vs Réel</h3>
          <div className="space-y-2">
            {lots.map((lot, i) => (
              <div key={lot.name} className="space-y-1">
                <span className="text-xs font-medium text-[#5c6f80]">{lot.name}</span>
                <div className="flex gap-2 h-4">
                  <div
                    className="bg-[#185FA5] rounded flex-shrink-0"
                    style={{ width: `${lot.progress}%` }}
                    title={`Réel: ${lot.progress}%`}
                  />
                  <div
                    className="bg-[#15803d] rounded flex-shrink-0"
                    style={{ width: `${70}%` }}
                    title="Prévu: 70%"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#e3e9ee] flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-[#185FA5] rounded" />
              <span className="text-[#5c6f80]">Réel</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-[#15803d] rounded" />
              <span className="text-[#5c6f80]">Prévu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-lg border border-[#e3e9ee] p-6">
        <h3 className="font-bold text-[#0b3b60] mb-4">Alertes & Actions</h3>
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const Icon = alert.icon
            const bgColor = {
              delay: 'bg-[#fdecec]',
              success: 'bg-[#e9f7ee]',
              warning: 'bg-[#fdf1e0]',
            }[alert.type]
            const textColor = {
              delay: 'text-[#b91c1c]',
              success: 'text-[#15803d]',
              warning: 'text-[#b45309]',
            }[alert.type]
            return (
              <div key={i} className={`${bgColor} ${textColor} rounded-lg p-3 flex items-center gap-3`}>
                <Icon size={18} className="flex-shrink-0" />
                <span className="text-sm font-medium">{alert.text}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button className="bg-[#185FA5] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#0f5a90] transition">
          Nouvelle Visite
        </button>
        <button className="bg-[#185FA5] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#0f5a90] transition">
          Voir Gantt
        </button>
        <button className="bg-[#185FA5] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#0f5a90] transition">
          Générer CR
        </button>
      </div>
    </div>
  )
}
