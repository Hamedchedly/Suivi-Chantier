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
    <div className="pb-32">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="text-blue-600 font-semibold text-sm flex items-center gap-1 mb-3 hover:text-blue-800 active:opacity-70"
        >
          ← Logement
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Résumé visite</h2>
      </div>

      {/* Overall Progress */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <p className="text-sm text-gray-600 mb-3">Progression générale</p>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="text-4xl font-bold text-blue-600">{overallProgress}% complet</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
          <p className="text-sm text-gray-600 mt-2">Terminées</p>
        </div>
        <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-3xl font-bold text-orange-600">{toReviewTasks}</p>
          <p className="text-sm text-gray-600 mt-2">À revoir</p>
        </div>
        <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-3xl font-bold text-gray-600">{naTasks}</p>
          <p className="text-sm text-gray-600 mt-2">N/A</p>
        </div>
        <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-3xl font-bold text-red-600">{blockedTasks}</p>
          <p className="text-sm text-gray-600 mt-2">Bloquée</p>
        </div>
      </div>

      {/* Task Breakdown */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Détail des tâches</h3>
        <div className="bg-white border border-gray-200 rounded-lg divide-y">
          {tasks.map(task => (
            <div key={task.taskId} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{task.title}</p>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  task.state === 'ok' ? 'bg-green-100 text-green-800' :
                  task.state === 'to_review' ? 'bg-orange-100 text-orange-800' :
                  task.state === 'blocked' ? 'bg-red-100 text-red-800' :
                  task.state === 'na' ? 'bg-gray-100 text-gray-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.state === 'ok' ? 'OK' :
                   task.state === 'to_review' ? 'À revoir' :
                   task.state === 'blocked' ? 'Bloqué' :
                   task.state === 'na' ? 'N/A' : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex-1 mr-4">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${task.progress ?? 0}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm font-bold text-blue-600 whitespace-nowrap">
                  {task.progress ?? 0}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={onClose}
          className="w-full bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-700 active:scale-95 transition-all"
        >
          Générer le CR
        </button>
        <button
          onClick={onBack}
          className="w-full bg-gray-100 text-gray-900 px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 active:scale-95 transition-all"
        >
          Retour
        </button>
      </div>
    </div>
  )
}
