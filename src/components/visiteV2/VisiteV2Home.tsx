import { ChevronRight } from 'lucide-react'
import type { Visit, VisitZone } from '../../lib/visits'
import { lotLabel, lotCompany } from '../visite/visiteStyles'
import type { LotContact } from '../../lib/repo'

interface VisiteV2HomeProps {
  visit: Visit
  zones: VisitZone[]
  lots: LotContact[]
  onSelectLot: (zone: VisitZone, lotId: string) => void
  onSummary: () => void
}

export function VisiteV2Home({ visit, zones, lots, onSelectLot, onSummary }: VisiteV2HomeProps) {
  // Group lots by zone for this visit
  const zoneLotsMap = new Map<string, string[]>()
  zones.forEach(zone => {
    if (!zoneLotsMap.has(zone.refId)) {
      zoneLotsMap.set(zone.refId, [])
    }
    zone.tasks.forEach(task => {
      if (task.lotId && !zoneLotsMap.get(zone.refId)!.includes(task.lotId)) {
        zoneLotsMap.get(zone.refId)!.push(task.lotId)
      }
    })
  })

  const zone = zones[0] // For now, single zone view
  if (!zone) return <div className="text-center py-12">Aucune zone sélectionnée</div>

  const lotIds = zoneLotsMap.get(zone.refId) || []
  const uniqueLots = Array.from(new Set(lotIds))

  // Calculate overall progress
  const totalTasks = zone.tasks.length
  const completedTasks = zone.tasks.filter(t => (t.progress ?? 0) >= 100).length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Visite chantier</h1>
          <p className="text-sm text-slate-600 font-medium">Résidence Gambetta • Logement {zone.refId}</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Overall Progress Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Progression générale</h2>
            <span className="text-3xl font-bold text-slate-900">{overallProgress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">Lots</p>
            <p className="text-3xl font-bold text-blue-600">{uniqueLots.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">Tâches</p>
            <p className="text-3xl font-bold text-blue-600">{totalTasks}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">Complètes</p>
            <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">À revoir</p>
            <p className="text-3xl font-bold text-amber-600">
              {zone.tasks.filter(t => t.state === 'to_review').length}
            </p>
          </div>
        </div>

        {/* Lots Section */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Lots à contrôler</h3>
          <div className="space-y-3">
            {uniqueLots.map(lotId => {
              const lotTasks = zone.tasks.filter(t => t.lotId === lotId)
              const lotProgress = lotTasks.length > 0
                ? Math.round((lotTasks.filter(t => (t.progress ?? 0) >= 100).length / lotTasks.length) * 100)
                : 0
              const company = lotCompany(lots, lotId)

              return (
                <button
                  key={lotId}
                  onClick={() => onSelectLot(zone, lotId)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 active:scale-95 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        Lot {lotId} — {lotLabel(lots, lotId)}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{company || 'N/A'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-blue-600">{lotProgress}%</p>
                      <ChevronRight className="w-5 h-5 text-slate-400 ml-auto group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${lotProgress}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Summary Button */}
        <button
          onClick={onSummary}
          className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-4 rounded-xl font-semibold shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 font-medium"
        >
          Résumé de visite
        </button>
      </div>
    </div>
  )
}
