import { useState } from 'react'
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react'
import type { Visit, VisitZone, VisitTaskCheck } from '../../lib/visits'
import { lotLabel, lotCompany } from '../visite/visiteStyles'
import type { LotContact } from '../../lib/repo'

interface TaskWithSubtasks {
  task: VisitTaskCheck
  subtasks: VisitTaskCheck[]
}

interface VisiteV2LotPageProps {
  visit: Visit
  zone: VisitZone
  lotId: string
  lots: LotContact[]
  allLotsInZone: string[]
  currentLotIndex: number
  onBack: () => void
  onNext: () => void
  onPrev: () => void
  onUpdateTask: (taskId: string, updates: Partial<VisitTaskCheck>) => void
  onMenuClick?: (taskId: string) => void
}

export function VisiteV2LotPage({
  zone,
  lotId,
  lots,
  allLotsInZone,
  currentLotIndex,
  onBack,
  onNext,
  onPrev,
  onUpdateTask,
  onMenuClick,
}: VisiteV2LotPageProps) {
  const lotTasks = zone.tasks.filter(t => t.lotId === lotId)
  const lotProgress = lotTasks.length > 0
    ? Math.round((lotTasks.filter(t => (t.progress ?? 0) >= 100).length / lotTasks.length) * 100)
    : 0

  // Group main tasks with their subtasks
  const tasksMap = new Map<string, TaskWithSubtasks>()
  const mainTasks = lotTasks.filter(t => {
    // A task is "main" if it's not a subtask of another task in this lot
    // For now, we'll use a simple heuristic: if taskId doesn't contain '-sub-'
    return !t.taskId.includes('-sub-')
  })
  const subTasks = lotTasks.filter(t => t.taskId.includes('-sub-'))

  mainTasks.forEach(task => {
    tasksMap.set(task.taskId, {
      task,
      subtasks: subTasks.filter(st => st.taskId.startsWith(task.taskId + '-sub-'))
    })
  })

  const isLastLot = currentLotIndex >= allLotsInZone.length - 1
  const isFirstLot = currentLotIndex === 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="px-4 py-4">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-2 mb-3 active:opacity-70 transition-colors"
          >
            ← Logement
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Lot {lotId} — {lotLabel(lots, lotId)}</h2>
          <p className="text-sm text-slate-600 font-medium mt-1">
            {zone.refId} • {lotCompany(lots, lotId) || 'N/A'}
          </p>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Lot Progress Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 mb-8 shadow-sm">
          <p className="text-sm text-blue-700 font-semibold uppercase tracking-wide mb-3">Progression du lot</p>
          <div className="flex items-baseline gap-4">
            <p className="text-5xl font-bold text-blue-600">{lotProgress}%</p>
            <div className="flex-1 bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${lotProgress}%` }}
              />
            </div>
          </div>
        </div>

      {/* Tasks */}
      <h3 className="text-lg font-bold text-slate-900 mb-4">Tâches</h3>
      <div className="space-y-4">
        {Array.from(tasksMap.values()).map(({ task, subtasks }) => (
          <div key={task.taskId}>
            {/* Main Task */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-slate-900 leading-tight">{task.title}</p>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                      task.state === 'ok' ? 'bg-green-100 text-green-700 border border-green-200' :
                      task.state === 'to_review' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      task.state === 'blocked' ? 'bg-red-100 text-red-700 border border-red-200' :
                      task.state === 'na' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {task.state === 'ok' ? '✓ OK' :
                       task.state === 'to_review' ? '⚠ À revoir' :
                       task.state === 'blocked' ? '✕ Bloqué' :
                       task.state === 'na' ? '— N/A' : '○ En cours'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onMenuClick?.(task.taskId)}
                  className="p-2 hover:bg-slate-100 rounded-lg active:scale-90 transition-all flex-shrink-0 text-slate-400 hover:text-slate-600"
                  title="Actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Avancement</span>
                  <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{task.progress ?? 0}%</span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={task.progress ?? 0}
                    onChange={(e) => onUpdateTask(task.taskId, { progress: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <div className="ml-6 mt-3 space-y-2 mb-4 border-l-2 border-slate-200 pl-4">
                {subtasks.map(sub => (
                  <div key={sub.taskId} className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-slate-800">{sub.title}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            sub.state === 'ok' ? 'bg-green-100 text-green-700' :
                            sub.state === 'to_review' ? 'bg-amber-100 text-amber-700' :
                            sub.state === 'blocked' ? 'bg-red-100 text-red-700' :
                            sub.state === 'na' ? 'bg-slate-100 text-slate-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {sub.state === 'ok' ? '✓' :
                             sub.state === 'to_review' ? '⚠' :
                             sub.state === 'blocked' ? '✕' :
                             sub.state === 'na' ? '—' : '○'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onMenuClick?.(sub.taskId)}
                        className="p-1 hover:bg-slate-200 rounded active:scale-90 transition-all flex-shrink-0 text-slate-400 hover:text-slate-600"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Avancement</span>
                        <span className="text-xs font-bold text-blue-600">{sub.progress ?? 0}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sub.progress ?? 0}
                        onChange={(e) => onUpdateTask(sub.taskId, { progress: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4 flex gap-3">
        <button
          onClick={onPrev}
          disabled={isFirstLot}
          className="flex-1 px-4 py-3 border border-slate-300 rounded-lg font-semibold text-slate-900 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Précédent
        </button>
        <button
          onClick={onNext}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          {isLastLot ? 'Résumé' : 'Suivant'}
          {!isLastLot && <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}
