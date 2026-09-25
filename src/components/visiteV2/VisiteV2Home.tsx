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
    <div className="pb-32">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-1">Visite chantier</h1>
        <p className="text-sm text-gray-600">Résidence Gambetta • Logement {zone.refId}</p>
      </div>

      {/* Overall Progress */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-600 mb-2">Progression générale</p>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="text-3xl font-bold text-blue-600">{overallProgress}%</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <div className="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <p className="text-xl font-bold text-blue-600">{uniqueLots.length}</p>
          <p className="text-xs text-gray-600 mt-1">Lots</p>
        </div>
        <div className="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <p className="text-xl font-bold text-blue-600">{totalTasks}</p>
          <p className="text-xs text-gray-600 mt-1">Tâches</p>
        </div>
        <div className="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <p className="text-xl font-bold text-blue-600">{completedTasks}</p>
          <p className="text-xs text-gray-600 mt-1">Complètes</p>
        </div>
        <div className="text-center p-3 bg-white border border-gray-200 rounded-lg">
          <p className="text-xl font-bold text-orange-600">
            {zone.tasks.filter(t => t.state === 'to_review').length}
          </p>
          <p className="text-xs text-gray-600 mt-1">À revoir</p>
        </div>
      </div>

      {/* Lots */}
      <h3 className="text-lg font-bold text-gray-900 mb-3">Lots à contrôler</h3>
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
              className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 active:scale-95 transition-all"
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="flex-1 text-left">
                  <p className="font-bold text-gray-900">Lot {lotId} — {lotLabel(lots, lotId)}</p>
                  <p className="text-sm text-gray-600 mt-1">{company || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{lotProgress}%</p>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${lotProgress}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Summary Button */}
      <button
        onClick={onSummary}
        className="w-full bg-gray-100 text-gray-900 px-4 py-3 rounded-lg font-semibold mt-8 hover:bg-gray-200 active:scale-95 transition-all"
      >
        Résumé visite
      </button>
    </div>
  )
}
