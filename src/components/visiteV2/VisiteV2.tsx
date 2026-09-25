import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Visit, VisitZone, VisitTaskCheck } from '../../lib/visits'
import { getGanttTasks, getLotsConfig } from '../../lib/repo'
import type { LotContact } from '../../lib/repo'
import type { GanttTask } from '../../types/gantt'
import { VisiteV2Home } from './VisiteV2Home'
import { VisiteV2LotPage } from './VisiteV2LotPage'
import { VisiteV2Summary } from './VisiteV2Summary'
import {
  AddSubtaskModal,
  AddNoteModal,
  AddPhotoModal,
  EditTaskModal,
} from './VisiteV2Modals'
import { TaskActionMenu, type TaskAction } from './TaskActionMenu'

type View = 'home' | 'lot' | 'summary'

interface VisiteV2Props {
  visit: Visit
  onBack: () => void
  onUpdateVisit?: (patch: Partial<Visit>) => void
}

export function VisiteV2({ visit, onBack, onUpdateVisit }: VisiteV2Props) {
  const [view, setView] = useState<View>('home')
  const [currentLotIndex, setCurrentLotIndex] = useState(0)
  const [selectedZoneRef, setSelectedZoneRef] = useState<string | null>(null)
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [zones, setZones] = useState<VisitZone[]>(visit.zones || [])
  const [lots] = useState<LotContact[]>(getLotsConfig())
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null)
  const [menuTaskTitle, setMenuTaskTitle] = useState<string>('')

  // Modal states
  const [modals, setModals] = useState({
    addSubtask: false,
    addNote: false,
    addPhoto: false,
    editTask: false,
  })

  // Auto-save zones changes to visit
  useEffect(() => {
    if (zones.length > 0 && onUpdateVisit) {
      // Save zones back to parent visit
      onUpdateVisit({ zones })
    }
  }, [zones, onUpdateVisit])

  // Get unique lots in the selected zone
  const uniqueLots = useMemo(() => {
    if (!selectedZoneRef) return []
    const zone = zones.find(z => z.refId === selectedZoneRef)
    if (!zone) return []
    return Array.from(new Set(zone.tasks.map(t => t.lotId))).filter(Boolean)
  }, [zones, selectedZoneRef])

  // Handle lot selection
  const handleSelectLot = useCallback((zone: VisitZone, lotId: string) => {
    setSelectedZoneRef(zone.refId)
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
    setZones(prev =>
      prev.map(zone => ({
        ...zone,
        tasks: zone.tasks.map(t =>
          t.taskId === taskId ? { ...t, ...updates } : t
        ),
      }))
    )
  }, [])

  // Menu actions
  const handleMenuClick = useCallback((taskId: string) => {
    let taskTitle = ''
    for (const zone of zones) {
      const task = zone.tasks.find(t => t.taskId === taskId)
      if (task) {
        taskTitle = task.title
        break
      }
    }
    setMenuTaskId(taskId)
    setMenuTaskTitle(taskTitle)
  }, [zones])

  const openModal = (modal: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modal]: true }))
  }

  const closeModal = (modal: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modal]: false }))
  }

  const currentZone = zones.find(z => z.refId === selectedZoneRef)
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
            tasks={currentZone.tasks}
            onBack={() => setView('home')}
            onClose={onBack}
          />
        </div>
      )}

      {/* Task Action Menu */}
      <TaskActionMenu
        taskId={menuTaskId || ''}
        taskTitle={menuTaskTitle}
        isOpen={!!menuTaskId}
        onClose={() => setMenuTaskId(null)}
        onAction={(action: TaskAction['id']) => {
          const actionMap: Record<TaskAction['id'], keyof typeof modals> = {
            'add-subtask': 'addSubtask',
            'add-note': 'addNote',
            'add-photo': 'addPhoto',
            'edit-task': 'editTask',
          }
          openModal(actionMap[action])
        }}
      />

      {/* Modals */}
      <AddSubtaskModal
        isOpen={modals.addSubtask}
        onClose={() => closeModal('addSubtask')}
        onSubmit={(name, dueDate) => {
          // Create new subtask task check
          let parentLotId = ''
          for (const zone of zones) {
            const parentTask = zone.tasks.find(t => t.taskId === menuTaskId)
            if (parentTask) {
              parentLotId = parentTask.lotId
              break
            }
          }
          const newSubtask: VisitTaskCheck = {
            taskId: `${menuTaskId}-sub-${Date.now()}`,
            lotId: parentLotId,
            title: name,
            state: 'not_checked',
            progress: 0,
            ...(dueDate && { baselineEnd: dueDate }),
          }
          setZones(prev =>
            prev.map(zone => ({
              ...zone,
              tasks: zone.tasks.map(t =>
                t.taskId === menuTaskId ? { ...t } : t
              ).concat(newSubtask),
            }))
          )
          closeModal('addSubtask')
          setMenuTaskId(null)
        }}
      />

      <AddNoteModal
        isOpen={modals.addNote}
        onClose={() => closeModal('addNote')}
        onSubmit={(date, note) => {
          if (menuTaskId) {
            handleUpdateTask(menuTaskId, {
              comment: note,
              plannedEnd: date,
            })
            closeModal('addNote')
            setMenuTaskId(null)
          }
        }}
      />

      <AddPhotoModal
        isOpen={modals.addPhoto}
        onClose={() => closeModal('addPhoto')}
        onSubmit={(file, annotation) => {
          // TODO: Integrate with photoStore
          console.log('Photo added:', file.name, annotation)
          closeModal('addPhoto')
          setMenuTaskId(null)
        }}
      />

      <EditTaskModal
        isOpen={modals.editTask}
        taskName={menuTaskTitle}
        onClose={() => closeModal('editTask')}
        onSubmit={(name, isNA) => {
          if (menuTaskId) {
            handleUpdateTask(menuTaskId, {
              title: name,
              state: isNA ? 'na' : 'not_checked',
            })
            closeModal('editTask')
            setMenuTaskId(null)
          }
        }}
      />
    </div>
  )
}
