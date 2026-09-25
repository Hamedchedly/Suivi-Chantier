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
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl overflow-hidden w-64"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">{taskTitle}</p>
            <p className="text-xs text-gray-500 mt-1">ID: {taskId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="py-1">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                onAction(action.id)
                onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span className={`${action.color}`}>
                {action.icon}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
