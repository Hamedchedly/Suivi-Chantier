import { useState, useRef, useEffect } from 'react'
import {
  Plus,
  StickyNote,
  Camera,
  Edit2,
  X,
} from 'lucide-react'

export interface TaskAction {
  id: 'add-subtask' | 'add-note' | 'add-photo' | 'edit-task'
  label: string
  icon: React.ReactNode
  color: string
}

interface TaskActionMenuProps {
  taskId: string
  taskTitle: string
  isOpen: boolean
  onClose: () => void
  onAction: (action: TaskAction['id']) => void
}

export function TaskActionMenu({
  taskId,
  taskTitle,
  isOpen,
  onClose,
  onAction,
}: TaskActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const actions: TaskAction[] = [
    {
      id: 'add-subtask',
      label: 'Ajouter sous-tâche',
      icon: <Plus className="w-4 h-4" />,
      color: 'text-blue-600',
    },
    {
      id: 'add-note',
      label: 'Ajouter note',
      icon: <StickyNote className="w-4 h-4" />,
      color: 'text-orange-600',
    },
    {
      id: 'add-photo',
      label: 'Ajouter photo',
      icon: <Camera className="w-4 h-4" />,
      color: 'text-green-600',
    },
    {
      id: 'edit-task',
      label: 'Modifier tâche',
      icon: <Edit2 className="w-4 h-4" />,
      color: 'text-purple-600',
    },
  ]

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden w-72 border border-slate-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-start bg-gradient-to-r from-slate-50 to-white">
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{taskTitle}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">ID: {taskId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition-all flex-shrink-0"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="py-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                onAction(action.id)
                onClose()
              }}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-blue-50 active:bg-blue-100 transition-colors text-left group border-b border-slate-100 last:border-b-0"
            >
              <span className={`${action.color} group-hover:scale-110 transition-transform`}>
                {action.icon}
              </span>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
