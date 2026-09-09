import { useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Card, KPIGrid, ProgressBar, Chip } from '../common/Card'
import type { Operation, Lot } from '../../lib/types'

interface DashboardProps {
  operation: Operation | null
  lots: Lot[]
}

export function Dashboard({ operation, lots }: DashboardProps) {
  const stats = useMemo(() => {
    if (!lots.length) {
      return {
        progress: 0,
        onTimeCount: 0,
        lateCount: 0,
        blockingCount: 0,
        lotProgress: [],
        timeline: [],
      }
    }

    // Calcul des stats (données mockées pour le prototype)
    const progress = Math.round(lots.reduce((sum, lot) => sum + (lot.amount_contract_ht || 0), 0) / lots.length)
    const onTimeCount = lots.filter(l => l.lot_status === 'actif').length
    const lateCount = lots.filter(l => l.lot_status === 'suspendu').length
    const blockingCount = 0

    // Données pour graphiques
    const lotProgress = lots.map((lot, i) => ({
      name: lot.code || `LOT ${i + 1}`,
      progress: Math.round(Math.random() * 100),
      planned: 70,
    }))

    const timeline = [
      { week: 'S36', actual: 20, planned: 25 },
      { week: 'S37', actual: 45, planned: 50 },
      { week: 'S38', actual: 60, planned: 70 },
      { week: 'S39', actual: 75, planned: 85 },
      { week: 'S40', actual: 85, planned: 95 },
    ]

    return {
      progress,
      onTimeCount,
      lateCount,
      blockingCount,
      lotProgress,
      timeline,
    }
  }, [lots])

  const COLORS = ['#15803d', '#185FA5', '#b91c1c', '#6d28d9']

  const statusData = [
    { name: 'À jour', value: stats.onTimeCount, color: '#15803d' },
    { name: 'En retard', value: stats.lateCount, color: '#b91c1c' },
    { name: 'Suspendu', value: 0, color: '#c2410c' },
  ]

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#0b3b60] mb-2">
          {operation?.name || 'Tableau de Bord'}
        </h1>
        {operation?.reference_interne && (
          <p className="text-[#5c6f80]">Ref. {operation.reference_interne}</p>
        )}
      </div>

      {/* KPIs */}
      <KPIGrid
        items={[
          {
            label: 'Avancement Global',
            value: `${stats.progress}%`,
            variant: 'success',
            trend: 8,
          },
          {
            label: 'Lots À Jour',
            value: stats.onTimeCount,
            variant: 'success',
          },
          {
            label: 'Lots En Retard',
            value: stats.lateCount,
            variant: 'warning',
          },
          {
            label: 'Points Bloquants',
            value: stats.blockingCount,
            variant: 'danger',
          },
        ]}
      />

      {/* Timeline Chart */}
      <Card title="Avancement Temporel (S36-S40)">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e9ee" />
              <XAxis dataKey="week" stroke="#5c6f80" />
              <YAxis stroke="#5c6f80" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e3e9ee',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#185FA5"
                strokeWidth={3}
                name="Réel"
                dot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="planned"
                stroke="#15803d"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Prévu"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Lot Progress */}
      <Card title="Avancement par Lot">
        <div className="space-y-4">
          {stats.lotProgress.map((lot) => (
            <div key={lot.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#16222e]">{lot.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#185FA5]">{lot.progress}%</span>
                  <Chip
                    label={lot.progress >= lot.planned ? 'À jour' : 'Retard'}
                    variant={lot.progress >= lot.planned ? 'success' : 'warning'}
                    size="sm"
                  />
                </div>
              </div>
              <ProgressBar
                value={lot.progress}
                variant={lot.progress >= lot.planned ? 'success' : 'warning'}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Pie Chart */}
        <Card title="Distribution des Statuts">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Bar Chart */}
        <Card title="Comparaison Planifié vs Réel">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.lotProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e9ee" />
                <XAxis dataKey="name" stroke="#5c6f80" />
                <YAxis stroke="#5c6f80" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e3e9ee',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="progress" fill="#185FA5" name="Réel" radius={[8, 8, 0, 0]} />
                <Bar dataKey="planned" fill="#15803d" name="Prévu" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card title="Alertes & Actions">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-[#fdecec] border border-[#fca5a5] rounded-lg">
            <AlertCircle className="text-[#b91c1c] flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-[#b91c1c]">2 lots en retard</p>
              <p className="text-sm text-[#5c6f80]">LOT 06 et LOT 08 dépassent leur planning de 3-5 jours</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[#e9f7ee] border border-[#86efac] rounded-lg">
            <CheckCircle className="text-[#15803d] flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-[#15803d]">LOT 05 terminé</p>
              <p className="text-sm text-[#5c6f80]">Menuiseries intérieures complétées le 08/09</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[#fff7ed] border border-[#fdba74] rounded-lg">
            <Clock className="text-[#c2410c] flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-[#c2410c]">Visite prévue demain</p>
              <p className="text-sm text-[#5c6f80]">10h00 - Débriefing retards LOT 06</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="p-4 bg-[#185FA5] text-white rounded-lg font-medium hover:bg-[#0b3b60] transition-colors">
          Nouvelle Visite
        </button>
        <button className="p-4 bg-white text-[#185FA5] border border-[#185FA5] rounded-lg font-medium hover:bg-[#e6f1fb] transition-colors">
          Voir Gantt
        </button>
        <button className="p-4 bg-white text-[#185FA5] border border-[#185FA5] rounded-lg font-medium hover:bg-[#e6f1fb] transition-colors">
          Générer CR
        </button>
      </div>
    </div>
  )
}
