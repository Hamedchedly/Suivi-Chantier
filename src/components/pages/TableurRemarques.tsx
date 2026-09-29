import React, { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { Note } from '../../types/notes'
import { getAllNotes, saveNote } from '../../lib/notes'
import { getLotsConfig, getZoneRefs } from '../../lib/repo'
import { validateAllNotes } from '../../lib/inconsistencies'

export function TableurRemarques() {
  const [notes, setNotes] = useState<Note[]>(getAllNotes())
  const [showClosed, setShowClosed] = useState(false)
  const [filterLogement, setFilterLogement] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const inconsistencies = validateAllNotes()
  const lotsConfig = getLotsConfig()
  const zoneRefs = getZoneRefs()

  // Filter notes
  const filtered = useMemo(() => {
    let result = [...notes]

    if (!showClosed) {
      result = result.filter(n => !n.closedCrNo)
    }

    if (filterLogement) {
      result = result.filter(n => n.context.logementIds.includes(filterLogement))
    }

    if (filterCompany) {
      result = result.filter(n => n.context.companyIds.includes(filterCompany))
    }

    if (filterStatus) {
      result = result.filter(n => n.status === filterStatus)
    }

    return result.sort((a, b) => a.number.localeCompare(b.number))
  }, [notes, showClosed, filterLogement, filterCompany, filterStatus])

  const handleSaveCell = (note: Note, field: string, value: string) => {
    let updatedNote = { ...note }

    switch (field) {
      case 'description':
        updatedNote.description = value
        break
      case 'priority':
        updatedNote.priority = value as any
        break
      case 'status':
        updatedNote.status = value as any
        break
      case 'dueDate':
        updatedNote.dueDate = value || undefined
        break
    }

    saveNote(updatedNote)
    setNotes(getAllNotes())
    setEditingCell(null)
  }

  const getUniqueLots = () => Object.keys(lotsConfig)
  const getUniqueCompanies = () => [...new Set(notes.flatMap(n => n.context.companyIds))].sort()
  const getUniqueLogements = () => zoneRefs.map(z => z.id).sort()
  const getUniqueStatuses = () => ['à faire', 'en cours', 'retard', 'fait', 'obsolète']

  const statusColor: Record<string, string> = {
    'à faire': 'bg-gray-100 text-gray-800',
    'en cours': 'bg-blue-100 text-blue-800',
    'retard': 'bg-red-100 text-red-800',
    'fait': 'bg-green-100 text-green-800',
    'obsolète': 'bg-gray-200 text-gray-600'
  }

  const priorityColor: Record<string, string> = {
    'low': 'text-gray-600',
    'medium': 'text-blue-600',
    'high': 'text-red-600'
  }

  const priorityLabel: Record<string, string> = {
    'low': 'Basse',
    'medium': 'Moyenne',
    'high': 'Haute'
  }

  return (
    <div className='p-4 space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>Tableur Remarques</h1>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
          />
          Afficher fermées
        </label>
      </div>

      {/* Filters */}
      <div className='flex gap-3 flex-wrap bg-gray-50 p-3 rounded-lg'>
        <select
          value={filterLogement}
          onChange={(e) => setFilterLogement(e.target.value)}
          className='px-2 py-1 border border-gray-300 rounded text-sm'
        >
          <option value=''>Tous logements</option>
          {getUniqueLogements().map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className='px-2 py-1 border border-gray-300 rounded text-sm'
        >
          <option value=''>Toutes entreprises</option>
          {getUniqueCompanies().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className='px-2 py-1 border border-gray-300 rounded text-sm'
        >
          <option value=''>Tous statuts</option>
          {getUniqueStatuses().map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className='overflow-x-auto bg-white border border-gray-200 rounded-lg'>
        <table className='w-full text-sm'>
          <thead className='bg-gray-50 border-b border-gray-200'>
            <tr>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>N°</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>CR</th>
              <th className='px-3 py-2 text-left font-semibold text-gray-700'>Date</th>
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
            {filtered.map(note => {
              const hasIssues = inconsistencies.has(note.id)
              return (
                <tr key={note.id} className={`border-b border-gray-200 hover:bg-blue-50 ${hasIssues ? 'bg-yellow-50' : ''}`}>
                  {/* Number */}
                  <td className='px-3 py-2 font-medium text-gray-700'>{note.number}</td>

                  {/* CR No */}
                  <td className='px-3 py-2'>CR {note.context.crNo}</td>

                  {/* Date */}
                  <td className='px-3 py-2 text-gray-600'>{note.context.meetingDate}</td>

                  {/* Description (editable) */}
                  <td
                    className='px-3 py-2 cursor-pointer hover:bg-white'
                    onClick={() => {
                      setEditingCell({ id: note.id, field: 'description' })
                      setEditValue(note.description)
                    }}
                  >
                    {editingCell?.id === note.id && editingCell.field === 'description' ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveCell(note, 'description', editValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCell(note, 'description', editValue)
                        }}
                        className='w-full px-1 py-0.5 border border-blue-500 rounded text-xs'
                      />
                    ) : (
                      <div className='flex items-start gap-2'>
                        <span className='flex-1'>{note.description}</span>
                        {hasIssues && <span className='text-yellow-600 text-lg'>⚠️</span>}
                      </div>
                    )}
                  </td>

                  {/* Lots */}
                  <td className='px-3 py-2'>
                    {note.context.lotIds.length > 0 ? (
                      note.context.lotIds.map((lid, i) => (
                        <div key={i} className='text-xs'>{lid}</div>
                      ))
                    ) : (
                      <span className='text-gray-400 text-xs'>—</span>
                    )}
                  </td>

                  {/* Logements */}
                  <td className='px-3 py-2'>
                    {note.context.logementIds.length > 0 ? (
                      note.context.logementIds.map((lid, i) => (
                        <div key={i} className='text-xs'>{lid}</div>
                      ))
                    ) : (
                      <span className='text-gray-400 text-xs'>—</span>
                    )}
                  </td>

                  {/* Priority (editable) */}
                  <td
                    className='px-3 py-2 cursor-pointer hover:bg-white'
                    onClick={() => {
                      setEditingCell({ id: note.id, field: 'priority' })
                      setEditValue(note.priority)
                    }}
                  >
                    {editingCell?.id === note.id && editingCell.field === 'priority' ? (
                      <select
                        autoFocus
                        value={editValue}
                        onChange={(e) => {
                          handleSaveCell(note, 'priority', e.target.value)
                        }}
                        className='text-xs border border-blue-500 rounded px-1 py-0.5'
                      >
                        <option value='low'>Basse</option>
                        <option value='medium'>Moyenne</option>
                        <option value='high'>Haute</option>
                      </select>
                    ) : (
                      <span className={`font-medium ${priorityColor[note.priority]}`}>
                        {priorityLabel[note.priority]}
                      </span>
                    )}
                  </td>

                  {/* Status (editable) */}
                  <td
                    className='px-3 py-2 cursor-pointer hover:bg-white'
                    onClick={() => {
                      setEditingCell({ id: note.id, field: 'status' })
                      setEditValue(note.status)
                    }}
                  >
                    {editingCell?.id === note.id && editingCell.field === 'status' ? (
                      <select
                        autoFocus
                        value={editValue}
                        onChange={(e) => {
                          handleSaveCell(note, 'status', e.target.value)
                        }}
                        className='text-xs border border-blue-500 rounded px-1 py-0.5'
                      >
                        <option value='à faire'>À faire</option>
                        <option value='en cours'>En cours</option>
                        <option value='retard'>Retard</option>
                        <option value='fait'>Fait</option>
                        <option value='obsolète'>Obsolète</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[note.status]}`}>
                        {note.status}
                      </span>
                    )}
                  </td>

                  {/* Due Date (editable) */}
                  <td
                    className='px-3 py-2 cursor-pointer hover:bg-white'
                    onClick={() => {
                      setEditingCell({ id: note.id, field: 'dueDate' })
                      setEditValue(note.dueDate || '')
                    }}
                  >
                    {editingCell?.id === note.id && editingCell.field === 'dueDate' ? (
                      <input
                        type='date'
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveCell(note, 'dueDate', editValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCell(note, 'dueDate', editValue)
                        }}
                        className='text-xs border border-blue-500 rounded px-1 py-0.5'
                      />
                    ) : (
                      <span className='text-gray-600'>{note.dueDate || '—'}</span>
                    )}
                  </td>

                  {/* Companies */}
                  <td className='px-3 py-2'>
                    {note.context.companyIds.length > 0 ? (
                      note.context.companyIds.map((cid, i) => (
                        <div key={i} className='text-xs'>{cid}</div>
                      ))
                    ) : (
                      <span className='text-gray-400 text-xs'>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className='text-center text-gray-500 py-8'>
          Aucune remarque à afficher
        </div>
      )}

      {/* Summary */}
      <div className='text-sm text-gray-600'>
        {filtered.length} remarque{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}
        {inconsistencies.size > 0 && (
          <span className='ml-4 text-yellow-600'>
            ⚠️ {inconsistencies.size} remarque{inconsistencies.size !== 1 ? 's' : ''} avec incohérences
          </span>
        )}
      </div>
    </div>
  )
}
