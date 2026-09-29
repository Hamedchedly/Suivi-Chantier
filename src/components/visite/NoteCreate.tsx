import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Note, NotePriority } from '../../types/notes'
import { saveNote, nextNoteNumber, getAllNotes } from '../../lib/notes'
import { getLotsConfig } from '../../lib/repo'

interface NoteCreateProps {
  lotId?: string
  logementId?: string
  taskId?: string
  crNo: number
  meetingDate: string
  companyIds?: string[]
  onNoteSaved?: (note: Note) => void
}

export function NoteCreate({
  lotId,
  logementId,
  taskId,
  crNo,
  meetingDate,
  companyIds = [],
  onNoteSaved
}: NoteCreateProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<NotePriority>('medium')
  const [dueDate, setDueDate] = useState('')

  const handleCreate = () => {
    if (!description.trim()) return

    const allNotes = getAllNotes()
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number: nextNoteNumber(allNotes),
      description: description.trim(),
      priority,
      status: 'à faire',
      context: {
        crNo,
        meetingDate,
        lotIds: lotId ? [lotId] : [],
        logementIds: logementId ? [logementId] : [],
        taskId,
        companyIds
      },
      dueDate: dueDate || undefined,
      createdCrNo: crNo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    saveNote(note)
    setDescription('')
    setPriority('medium')
    setDueDate('')
    setIsOpen(false)

    if (onNoteSaved) {
      onNoteSaved(note)
    }
  }

  const lotLabel = lotId ? getLotsConfig()[lotId]?.title || lotId : 'non spécifié'

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-sm font-medium'
      >
        <Plus size={16} />
        Nouvelle note
      </button>
    )
  }

  return (
    <div className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='font-semibold text-sm'>Nouvelle remarque</h3>
        <button
          onClick={() => setIsOpen(false)}
          className='text-gray-400 hover:text-gray-600'
        >
          <X size={18} />
        </button>
      </div>

      <div className='space-y-3'>
        {/* Context info */}
        <div className='text-xs text-gray-500 bg-gray-50 p-2 rounded'>
          {lotId && <div>Lot: <span className='font-medium'>{lotLabel}</span></div>}
          {logementId && <div>Logement: <span className='font-medium'>{logementId}</span></div>}
          {taskId && <div>Tâche: <span className='font-medium'>{taskId}</span></div>}
        </div>

        {/* Description */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Description de la remarque...'
          className='w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          rows={3}
        />

        {/* Priority */}
        <div className='flex items-center gap-2'>
          <label className='text-xs font-medium text-gray-600'>Priorité:</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as NotePriority)}
            className='px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='low'>Basse</option>
            <option value='medium'>Moyenne</option>
            <option value='high'>Haute</option>
          </select>
        </div>

        {/* Due date */}
        <div className='flex items-center gap-2'>
          <label className='text-xs font-medium text-gray-600'>Délai (optionnel):</label>
          <input
            type='date'
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className='px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        {/* Actions */}
        <div className='flex gap-2 justify-end'>
          <button
            onClick={() => setIsOpen(false)}
            className='px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50'
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={!description.trim()}
            className='px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}
