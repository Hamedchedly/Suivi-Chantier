import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'

export function Dashboard() {
  // Mock data
  const timelineData = [
    { week: 'S36', real: 20, planned: 25 },
    { week: 'S37', real: 45, planned: 50 },
    { week: 'S38', real: 60, planned: 70 },
    { week: 'S39', real: 75, planned: 85 },
    { week: 'S40', real: 85, planned: 95 },
  ]

  const lotData = [
    { name: 'Gros œuvre', real: 75, planned: 70 },
    { name: 'Façades', real: 63, planned: 65 },
    { name: 'Fluides', real: 45, planned: 60 },
    { name: 'Finitions', real: 20, planned: 50 },
  ]

  const statusData = [
    { name: 'À jour', value: 3, fill: '#15803d' },
    { name: 'En retard', value: 1, fill: '#b91c1c' },
    { name: 'Suspendu', value: 0, fill: '#c2410c' },
  ]

  const customTooltip = ({ active, payload }: {
    active?: boolean
    payload?: { name?: string; value?: number; color?: string; payload?: { week?: string; name?: string } }[]
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-[#e3e9ee] rounded-lg shadow-lg">
          <p className="text-sm font-medium text-[#16222e]">{payload[0].payload?.week || payload[0].payload?.name}</p>
          {payload.map((entry, idx: number) => (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0d3f68] to-[#0b3b60] text-white rounded-lg p-8">
        <h1 className="text-4xl font-bold mb-2">Gambetta — Réhabilitation</h1>
        <p className="text-blue-100 text-lg">Ref. GAM-2026-001 • Mairie de Reims</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm hover:shadow-md transition">
          <p className="text-xs uppercase font-bold text-[#5c6f80] mb-3 tracking-wide">Avancement Global</p>
          <p className="text-5xl font-bold text-[#0b3b60] mb-2">63%</p>
          <div className="flex items-center gap-2 text-green-600">
            <TrendingUp size={16} />
            <span className="text-sm font-semibold">+8% cette semaine</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm hover:shadow-md transition">
          <p className="text-xs uppercase font-bold text-[#5c6f80] mb-3 tracking-wide">Lots À Jour</p>
          <p className="text-5xl font-bold text-[#15803d]">3</p>
          <p className="text-sm text-[#5c6f80] mt-2">sur 4 lots</p>
        </div>

        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm hover:shadow-md transition">
          <p className="text-xs uppercase font-bold text-[#5c6f80] mb-3 tracking-wide">Lots En Retard</p>
          <p className="text-5xl font-bold text-[#b91c1c]">1</p>
          <p className="text-sm text-[#5c6f80] mt-2">Fluides (45%)</p>
        </div>

        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm hover:shadow-md transition">
          <p className="text-xs uppercase font-bold text-[#5c6f80] mb-3 tracking-wide">Points Bloquants</p>
          <p className="text-5xl font-bold text-[#0b3b60]">0</p>
          <p className="text-sm text-green-600 font-semibold mt-2">✓ Tous résolus</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0b3b60] mb-4">Avancement Temporel</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e9ee" />
              <XAxis dataKey="week" stroke="#5c6f80" style={{ fontSize: '12px' }} />
              <YAxis stroke="#5c6f80" style={{ fontSize: '12px' }} />
              <Tooltip content={customTooltip} />
              <Legend />
              <Line
                type="monotone"
                dataKey="real"
                stroke="#185FA5"
                strokeWidth={3}
                dot={{ fill: '#185FA5', r: 6 }}
                activeDot={{ r: 8 }}
                name="Réel"
              />
              <Line
                type="monotone"
                dataKey="planned"
                stroke="#15803d"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#15803d', r: 5 }}
                name="Prévu"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0b3b60] mb-4">Distribution des Statuts</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparison Chart */}
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0b3b60] mb-4">Comparaison Planifié vs Réel</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lotData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e9ee" />
              <XAxis dataKey="name" stroke="#5c6f80" style={{ fontSize: '12px' }} />
              <YAxis stroke="#5c6f80" style={{ fontSize: '12px' }} />
              <Tooltip content={customTooltip} />
              <Legend />
              <Bar dataKey="real" fill="#185FA5" radius={[8, 8, 0, 0]} name="Réel" />
              <Bar dataKey="planned" fill="#15803d" radius={[8, 8, 0, 0]} name="Prévu" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lot Progress */}
        <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0b3b60] mb-4">Avancement par Lot</h2>
          <div className="space-y-5">
            {[
              { name: 'LOT 01 — Gros œuvre', progress: 75, status: 'À jour', statusColor: 'bg-green-50 text-green-700' },
              { name: 'LOT 02 — Façades', progress: 63, status: 'À jour', statusColor: 'bg-green-50 text-green-700' },
              { name: 'LOT 03 — Fluides', progress: 45, status: 'Retard', statusColor: 'bg-orange-50 text-orange-700' },
              { name: 'LOT 04 — Finitions', progress: 20, status: 'À jour', statusColor: 'bg-green-50 text-green-700' },
            ].map((lot) => (
              <div key={lot.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[#16222e] text-sm">{lot.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#185FA5]">{lot.progress}%</span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${lot.statusColor}`}>
                      {lot.status}
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-[#e6edf3] rounded-full overflow-hidden">
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
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#0b3b60] mb-4">Alertes & Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 border-l-4 border-red-500 rounded p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-900">2 lots en retard</p>
              <p className="text-sm text-red-700">Fluides (45%), Finitions (20%)</p>
            </div>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 rounded p-4 flex items-start gap-3">
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-green-900">Inspection finalisée</p>
              <p className="text-sm text-green-700">Gros œuvre — Validé ✓</p>
            </div>
          </div>

          <div className="bg-orange-50 border-l-4 border-orange-500 rounded p-4 flex items-start gap-3">
            <Clock className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-orange-900">Visite prévue demain</p>
              <p className="text-sm text-orange-700">10h00 — Débriefing retards LOT 06</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="bg-gradient-to-r from-[#0f5a90] to-[#1f8bd2] hover:from-[#0d4a78] hover:to-[#1870b8] text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 shadow-md">
          + Nouvelle Visite
        </button>
        <button className="bg-gradient-to-r from-[#0f5a90] to-[#1f8bd2] hover:from-[#0d4a78] hover:to-[#1870b8] text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 shadow-md">
          📊 Voir Gantt
        </button>
        <button className="bg-gradient-to-r from-[#0f5a90] to-[#1f8bd2] hover:from-[#0d4a78] hover:to-[#1870b8] text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 shadow-md">
          📄 Générer CR
        </button>
      </div>
    </div>
  )
}
