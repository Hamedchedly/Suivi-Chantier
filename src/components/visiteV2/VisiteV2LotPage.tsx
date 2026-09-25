import { useState } from 'react'
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react'
import type { Visit, VisitZone, VisitTaskCheck } from '../../lib/visits'
import { lotLabel, lotCompany } from '../visite/visiteStyles'
import type { LotContact, GanttTask } from '../../lib/repo'

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
  lotTasks.forEach(task => {
    if (!tasksMap.has(task.taskId)) {
      tasksMap.set(task.taskId, { task, subtasks: [] })
    }
  })

  const isLastLot = currentLotIndex >= allLotsInZone.length - 1
  const isFirstLot = currentLotIndex === 0

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-blue-600 font-semibold text-sm flex items-center gap-1 mb-3 hover:text-blue-800 active:opacity-70"
        >
          ← Logement
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Lot {lotId} — {lotLabel(lots, lotId)}</h2>
        <p className="text-sm text-gray-600 mt-2">
          {zone.ref} • {lotCompany(lots, lotId) || 'N/A'}
        </p>
      </div>

      {/* Lot Progress */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-center">
        <p className="text-sm text-gray-600 mb-2">Progression du lot</p>
        <p className="text-4xl font-bold text-blue-600">{lotProgress}%</p>
      </div>

      {/* Tasks */}
      <h3 className="text-lg font-bold text-gray-900 mb-4">Tâches</h3>
      <div className="space-y-4">
        {Array.from(tasksMap.values()).map(({ task, subtasks }) => (
          <div key={task.taskId}>
            {/* Main Task */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{task.progress ?? 0}%</p>
                </div>
                <button
                  onClick={() => onMenuClick?.(task.taskId)}
                  className="p-1 hover:bg-gray-100 rounded active:scale-90 transition-all"
                >
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Slider */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Avancement</span>
                  <span className="font-bold text-blue-600">{task.progress ?? 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={task.progress ?? 0}
                  onChange={(e) => onUpdateTask(task.taskId, { progress: parseInt(e.target.value) })}
                  className="w-full cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <div className="ml-4 space-y-2 mb-4">
                {subtasks.map(sub => (
                  <div key={sub.taskId} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{sub.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{sub.progress ?? 0}%</p>
                      </div>
                      <button
                        onClick={() => onMenuClick?.(sub.taskId)}
                        className="p-1 hover:bg-gray-100 rounded active:scale-90 transition-all"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    {/* Slider */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Avancement</span>
                        <span className="font-bold text-blue-600">{sub.progress ?? 0}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sub.progress ?? 0}
                        onChange={(e) => onUpdateTask(sub.taskId, { progress: parseInt(e.target.value) })}
                        className="w-full cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex gap-2">
        <button
          onClick={onPrev}
          disabled={isFirstLot}
          className="flex-1 px-3 py-3 border border-gray-200 rounded-lg font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Lot précédent
        </button>
        <button
          onClick={onNext}
          className="flex-1 px-3 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isLastLot ? 'Résumé' : 'Lot suivant'}
          {!isLastLot && <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}
