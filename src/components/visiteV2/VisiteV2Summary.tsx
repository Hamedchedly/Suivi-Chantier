import type { Visit, VisitZone, VisitTaskCheck } from '../../lib/visits'

interface VisiteV2SummaryProps {
  visit: Visit
  zone: VisitZone
  tasks: VisitTaskCheck[]
  onBack: () => void
  onClose: () => void
}

export function VisiteV2Summary({ zone, tasks, onBack, onClose }: VisiteV2SummaryProps) {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => (t.progress ?? 0) >= 100).length
  const toReviewTasks = tasks.filter(t => t.state === 'to_review').length
  const naTasks = tasks.filter(t => t.state === 'na').length
  const blockedTasks = tasks.filter(t => t.state === 'blocked').length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

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
          <h2 className="text-2xl font-bold text-slate-900">Résumé visite</h2>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Overall Progress */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-blue-700 font-semibold uppercase tracking-wide mb-4">Progression générale</p>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-5xl font-bold text-blue-600">{overallProgress}%</p>
              <p className="text-sm text-blue-700 font-medium mt-1">Complété</p>
            </div>
            <div className="flex-1 bg-blue-200 rounded-full h-4 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">Terminées</p>
            <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">À revoir</p>
            <p className="text-3xl font-bold text-amber-600">{toReviewTasks}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">N/A</p>
            <p className="text-3xl font-bold text-slate-600">{naTasks}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-2">Bloquée</p>
            <p className="text-3xl font-bold text-red-600">{blockedTasks}</p>
          </div>
        </div>

        {/* Task Breakdown */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Détail des tâches</h3>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
            {tasks.map(task => (
              <div key={task.taskId} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <p className="font-semibold text-slate-900 flex-1">{task.title}</p>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ml-2 flex-shrink-0 border ${
                    task.state === 'ok' ? 'bg-green-100 text-green-700 border-green-200' :
                    task.state === 'to_review' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    task.state === 'blocked' ? 'bg-red-100 text-red-700 border-red-200' :
                    task.state === 'na' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {task.state === 'ok' ? '✓ OK' :
                     task.state === 'to_review' ? '⚠ À revoir' :
                     task.state === 'blocked' ? '✕ Bloqué' :
                     task.state === 'na' ? '— N/A' : '○ —'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                        style={{ width: `${task.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap">
                    {task.progress ?? 0}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-4 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 active:scale-95 transition-all shadow-md hover:shadow-lg"
          >
            ✓ Générer le CR
          </button>
          <button
            onClick={onBack}
            className="w-full bg-slate-200 text-slate-900 px-4 py-4 rounded-xl font-semibold hover:bg-slate-300 active:scale-95 transition-all"
          >
            ← Retour
          </button>
        </div>
      </div>
    </div>
  )
}
