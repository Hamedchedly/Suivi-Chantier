import React, { useState } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import { Note } from '../../types/notes'
import { saveNote, nextNoteNumber, getAllNotes } from '../../lib/notes'
import { getLotsConfig, getZoneRefs } from '../../lib/repo'

interface RemarquesVisiteTableProps {
  crNo: number
  meetingDate: string
  notes: Note[]
}

export function RemarquesVisiteTable({ crNo, meetingDate, notes }: RemarquesVisiteTableProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState<{ id?: string; field: string; value: string }>({ field: '', value: '' })

  const lotsConfig = getLotsConfig()
  const zoneRefs = getZoneRefs()

  const statusOptions = ['à faire', 'en cours', 'retard', 'fait', 'obsolète']
  const priorityOptions = ['low', 'medium', 'high']
  const priorityLabel: Record<string, string> = { 'low': 'Basse', 'medium': 'Moyenne', 'high': 'Haute' }

  const statusColor: Record<string, string> = {
    'à faire': 'bg-gray-100 text-gray-800',
    'en cours': 'bg-blue-100 text-blue-800',
    'retard': 'bg-red-100 text-red-800',
    'fait': 'bg-green-100 text-green-800',
    'obsolète': 'bg-gray-200 text-gray-600'
  }

  const handleStatusChange = (noteId: string, newStatus: string) => {
    const note = notes.find(n => n.id === noteId)
    if (note) {
      saveNote({ ...note, status: newStatus as any })
    }
  }

  const handleCellClick = (noteId: string, field: string, value: string) => {
    setModalData({ id: noteId, field, value })
    setShowModal(true)
  }

  const handleModalSave = () => {
    if (modalData.id) {
      const note = notes.find(n => n.id === modalData.id)
      if (note) {
        const updated: any = { ...note }
        if (modalData.field === 'description') updated.description = modalData.value
        else if (modalData.field === 'dueDate') updated.dueDate = modalData.value || undefined
        saveNote(updated)
      }
    }
    setShowModal(false)
  }

  const handleAddNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number: nextNoteNumber(getAllNotes()),
      description: '',
      priority: 'medium',
      status: 'à faire',
      context: {
        crNo,
        meetingDate,
        lotIds: [],
        logementIds: [],
        companyIds: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdCrNo: crNo
    }
    saveNote(newNote)
  }

  return (
    <div className='space-y-4'>
      {/* Modal for editing */}
      {showModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg shadow-lg p-6 max-w-md w-full'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>
                Modifier {modalData.field === 'description' ? 'remarque' : 'délai'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className='text-gray-500 hover:text-gray-700'
              >
                <X size={20} />
              </button>
            </div>

            {modalData.field === 'description' ? (
              <textarea
                value={modalData.value}
                onChange={(e) => setModalData({ ...modalData, value: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                rows={4}
                autoFocus
              />
            ) : (
              <input
                type='date'
                value={modalData.value}
                onChange={(e) => setModalData({ ...modalData, value: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                autoFocus
              />
            )}

            <div className='flex gap-2 justify-end mt-4'>
              <button
                onClick={() => setShowModal(false)}
                className='px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50'
              >
                Annuler
              </button>
              <button
                onClick={handleModalSave}
                className='px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700'
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className='overflow-x-auto bg-white border border-gray-200 rounded-lg'>
        <table className='w-full text-sm'>
          <thead className='bg-gray-50 border-b border-gray-200'>
            <tr>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>N°</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Remarque</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Lot(s)</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Logement(s)</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Priorité</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Statut</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Délai</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Entreprises</th>
            </tr>
          </thead>
          <tbody>
            {/* Existing notes */}
            {notes.map(note => (
              <tr key={note.id} className='border-b border-gray-200 hover:bg-blue-50'>
                <td className='px-3 py-2 font-medium text-gray-700'>{note.number}</td>
                <td
                  className='px-3 py-2 cursor-pointer hover:bg-white max-w-xs'
                  onClick={() => handleCellClick(note.id, 'description', note.description)}
                >
                  <div className='truncate'>{note.description}</div>
                </td>
                <td className='px-3 py-2 text-xs'>
                  {note.context.lotIds.length > 0 ? (
                    note.context.lotIds.map((lid, i) => <div key={i}>{lid}</div>)
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </td>
                <td className='px-3 py-2 text-xs'>
                  {note.context.logementIds.length > 0 ? (
                    note.context.logementIds.map((lid, i) => <div key={i}>{lid}</div>)
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </td>
                <td className='px-3 py-2 text-xs font-medium'>{priorityLabel[note.priority]}</td>
                <td className='px-3 py-2'>
                  <div className='relative w-32'>
                    <select
                      value={note.status}
                      onChange={(e) => handleStatusChange(note.id, e.target.value)}
                      className={`w-full px-2 py-1 rounded text-xs font-medium border-0 appearance-none cursor-pointer ${statusColor[note.status]}`}
                    >
                      {statusOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className='absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none' />
                  </div>
                </td>
                <td
                  className='px-3 py-2 cursor-pointer hover:bg-white text-gray-600 text-xs'
                  onClick={() => handleCellClick(note.id, 'dueDate', note.dueDate || '')}
                >
                  {note.dueDate ? note.dueDate : '—'}
                </td>
                <td className='px-3 py-2 text-xs'>
                  {note.context.companyIds.length > 0 ? (
                    note.context.companyIds.map((cid, i) => <div key={i}>{cid}</div>)
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </td>
              </tr>
            ))}

            {/* Add new note row */}
            <tr className='border-b border-gray-200 bg-blue-50 hover:bg-blue-100'>
              <td colSpan={8} className='px-3 py-3'>
                <button
                  onClick={handleAddNote}
                  className='flex items-center gap-2 text-blue-700 font-medium hover:text-blue-900'
                >
                  <Plus size={16} />
                  Ajouter une remarque
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {notes.length === 0 && (
        <div className='text-center py-8 text-gray-500'>
          <p>Aucune remarque pour cette visite</p>
          <button
            onClick={handleAddNote}
            className='mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-2'
          >
            <Plus size={16} />
            Ajouter la première remarque
          </button>
        </div>
      )}
    </div>
  )
}
