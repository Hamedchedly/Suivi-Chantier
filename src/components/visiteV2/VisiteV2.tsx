import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Visit, VisitZone, VisitTaskCheck } from '../../lib/visits'
import { buildZonesFromPlanning } from '../../lib/visits'
import { getGanttTasks, getLotsConfig } from '../../lib/repo'
import type { LotContact } from '../../lib/repo'
import { VisiteV2Home } from './VisiteV2Home'
import { VisiteV2LotPage } from './VisiteV2LotPage'
import { VisiteV2Summary } from './VisiteV2Summary'
import {
  AddSubtaskModal,
  AddNoteModal,
  AddPhotoModal,
  EditTaskModal,
} from './VisiteV2Modals'

type View = 'home' | 'lot' | 'summary'

interface VisiteV2Props {
  visit: Visit
  onBack: () => void
}

export function VisiteV2({ visit, onBack }: VisiteV2Props) {
  const [view, setView] = useState<View>('home')
  const [currentLotIndex, setCurrentLotIndex] = useState(0)
  const [selectedZoneRef, setSelectedZoneRef] = useState<string | null>(null)
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<VisitTaskCheck[]>(visit.tasks || [])
  const [lots] = useState<LotContact[]>(getLotsConfig())
  const [zones, setZones] = useState<VisitZone[]>([])
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null)

  // Modal states
  const [modals, setModals] = useState({
    addSubtask: false,
    addNote: false,
    addPhoto: false,
    editTask: false,
  })

  // Build zones from planning
  useEffect(() => {
    const ganttTasks = getGanttTasks()
    const builtZones = buildZonesFromPlanning(ganttTasks, visit.lotIds || [])
    // Map visit tasks to zones
    const zonesWithTasks = builtZones.map(zone => ({
      ...zone,
      tasks: tasks.filter(t => {
        const ganttTask = ganttTasks.find(gt => gt.id === t.taskId)
        return ganttTask?.zone === zone.ref
      }),
    }))
    setZones(zonesWithTasks)
  }, [visit, tasks])

  // Get unique lots in the selected zone
  const uniqueLots = useMemo(() => {
    if (!selectedZoneRef) return []
    const zone = zones.find(z => z.ref === selectedZoneRef)
    if (!zone) return []
    return Array.from(new Set(zone.tasks.map(t => t.lotId))).filter(Boolean)
  }, [zones, selectedZoneRef])

  // Handle lot selection
  const handleSelectLot = useCallback((zone: VisitZone, lotId: string) => {
    setSelectedZoneRef(zone.ref)
    setSelectedLotId(lotId)
    const index = uniqueLots.indexOf(lotId)
    setCurrentLotIndex(Math.max(0, index))
    setView('lot')
  }, [uniqueLots])

  // Handle lot navigation
  const handleNextLot = useCallback(() => {
    if (currentLotIndex >= uniqueLots.length - 1) {
      setView('summary')
    } else {
      const nextLotId = uniqueLots[currentLotIndex + 1]
      setSelectedLotId(nextLotId)
      setCurrentLotIndex(currentLotIndex + 1)
    }
  }, [currentLotIndex, uniqueLots])

  const handlePrevLot = useCallback(() => {
    if (currentLotIndex > 0) {
      const prevLotId = uniqueLots[currentLotIndex - 1]
      setSelectedLotId(prevLotId)
      setCurrentLotIndex(currentLotIndex - 1)
    }
  }, [currentLotIndex, uniqueLots])

  // Update task progress
  const handleUpdateTask = useCallback((taskId: string, updates: Partial<VisitTaskCheck>) => {
    setTasks(prev =>
      prev.map(t =>
        t.taskId === taskId ? { ...t, ...updates } : t
      )
    )
  }, [])

  // Menu actions
  const handleMenuClick = useCallback((taskId: string) => {
    setMenuTaskId(taskId)
  }, [])

  const openModal = (modal: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modal]: true }))
  }

  const closeModal = (modal: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modal]: false }))
  }

  const currentZone = zones.find(z => z.ref === selectedZoneRef)
  const currentLotId = uniqueLots[currentLotIndex]

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Home View */}
      {view === 'home' && zones.length > 0 && (
        <div className="px-4 pt-4">
          <button
            onClick={onBack}
            className="text-blue-600 font-semibold text-sm mb-4 hover:text-blue-800"
          >
            ← Retour
          </button>
          <VisiteV2Home
            visit={visit}
            zones={zones}
            lots={lots}
            onSelectLot={handleSelectLot}
            onSummary={() => setView('summary')}
          />
        </div>
      )}

      {/* Lot Page View */}
      {view === 'lot' && currentZone && currentLotId && (
        <div className="px-4 pt-4">
          <VisiteV2LotPage
            visit={visit}
            zone={currentZone}
            lotId={currentLotId}
            lots={lots}
            allLotsInZone={uniqueLots}
            currentLotIndex={currentLotIndex}
            onBack={() => setView('home')}
            onNext={handleNextLot}
            onPrev={handlePrevLot}
            onUpdateTask={handleUpdateTask}
            onMenuClick={handleMenuClick}
          />
        </div>
      )}

      {/* Summary View */}
      {view === 'summary' && currentZone && (
        <div className="px-4 pt-4">
          <VisiteV2Summary
            visit={visit}
            zone={currentZone}
            tasks={tasks}
            onBack={() => setView('home')}
            onClose={onBack}
          />
        </div>
      )}

      {/* Modals */}
      <AddSubtaskModal
        isOpen={modals.addSubtask}
        onClose={() => closeModal('addSubtask')}
        onSubmit={(name, dueDate) => {
          // TODO: Add subtask logic
          closeModal('addSubtask')
        }}
      />

      <AddNoteModal
        isOpen={modals.addNote}
        onClose={() => closeModal('addNote')}
        onSubmit={(date, note) => {
          if (menuTaskId) {
            handleUpdateTask(menuTaskId, { comment: note })
            closeModal('addNote')
          }
        }}
      />

      <AddPhotoModal
        isOpen={modals.addPhoto}
        onClose={() => closeModal('addPhoto')}
        onSubmit={(file, annotation) => {
          // TODO: Add photo logic
          closeModal('addPhoto')
        }}
      />

      <EditTaskModal
        isOpen={modals.editTask}
        taskName={tasks.find(t => t.taskId === menuTaskId)?.title || ''}
        onClose={() => closeModal('editTask')}
        onSubmit={(name, isNA) => {
          if (menuTaskId) {
            handleUpdateTask(menuTaskId, {
              title: name,
              state: isNA ? 'na' : undefined,
            })
            closeModal('editTask')
          }
        }}
      />
    </div>
  )
}
