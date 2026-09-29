import React, { useState, useMemo } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { getAllNotes, saveNote } from '../../lib/notes'
import { validateAllNotes, hasErrors } from '../../lib/inconsistencies'
import { getLotsConfig, getZoneRefs } from '../../lib/repo'

export function CorrectionIncohérences() {
  const allNotes = getAllNotes()
  const inconsistencies = validateAllNotes()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingNote, setEditingNote] = useState<string | null>(null)

  const lotsConfig = getLotsConfig()
  const zoneRefs = getZoneRefs()

  const notesWithIssues = useMemo(() => {
    return Array.from(inconsistencies.entries()).map(([noteId, issues]) => {
      const note = allNotes.find(n => n.id === noteId)
      return { note, issues }
    }).filter(x => x.note)
  }, [allNotes, inconsistencies])

  const toggleExpanded = (noteId: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId)
    } else {
      newExpanded.add(noteId)
    }
    setExpanded(newExpanded)
  }

  const handleAccept = (noteId: string) => {
    const note = allNotes.find(n => n.id === noteId)
    if (note) {
      saveNote(note)
      setEditingNote(null)
    }
  }

  const handleCorrectAndAccept = (noteId: string) => {
    const note = allNotes.find(n => n.id === noteId)
    if (note) {
      saveNote(note)
      setEditingNote(null)
    }
  }

  const handleDeferToNextVisit = (noteId: string) => {
    const note = allNotes.find(n => n.id === noteId)
    if (note) {
      note.status = 'en attente'
      saveNote(note)
      setEditingNote(null)
    }
  }

  const errorCount = Array.from(inconsistencies.values()).reduce(
    (sum, issues) => sum + issues.filter(i => i.severity === 'error').length,
    0
  )
  const warningCount = Array.from(inconsistencies.values()).reduce(
    (sum, issues) => sum + issues.filter(i => i.severity === 'warning').length,
    0
  )

  if (notesWithIssues.length === 0) {
    return (
      <div className='p-8 text-center'>
        <CheckCircle size={48} className='mx-auto mb-4 text-green-600' />
        <h2 className='text-xl font-semibold text-gray-800'>Pas d'incohérences détectées</h2>
        <p className='text-gray-600 mt-2'>Toutes les remarques sont cohérentes</p>
      </div>
    )
  }

  return (
    <div className='p-6 space-y-6'>
      <div>
        <h1 className='text-2xl font-bold mb-2'>Correction des incohérences</h1>
        <p className='text-gray-600'>
          {notesWithIssues.length} remarque{notesWithIssues.length !== 1 ? 's' : ''} avec problèmes détectés
        </p>
      </div>

      {/* Summary alerts */}
      <div className='grid grid-cols-2 gap-4'>
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <div className='flex items-center gap-2 mb-1'>
            <AlertCircle size={20} className='text-red-600' />
            <span className='font-semibold text-red-900'>Erreurs</span>
          </div>
          <div className='text-2xl font-bold text-red-600'>{errorCount}</div>
        </div>
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
          <div className='flex items-center gap-2 mb-1'>
            <AlertTriangle size={20} className='text-yellow-600' />
            <span className='font-semibold text-yellow-900'>Avertissements</span>
          </div>
          <div className='text-2xl font-bold text-yellow-600'>{warningCount}</div>
        </div>
      </div>

      {/* Notes list */}
      <div className='space-y-3'>
        {notesWithIssues.map(({ note, issues }) => {
          if (!note) return null
          const isExpanded = expanded.has(note.id)
          const hasError = hasErrors(issues)

          return (
            <div
              key={note.id}
              className={`border rounded-lg p-4 ${hasError ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}
            >
              {/* Header */}
              <button
                onClick={() => toggleExpanded(note.id)}
                className='w-full text-left flex items-center gap-3 hover:opacity-75'
              >
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                <div className='flex-1'>
                  <div className='font-semibold flex items-center gap-2'>
                    {note.number} — {note.description.substring(0, 60)}
                    {note.description.length > 60 ? '...' : ''}
                    {hasError && <AlertCircle size={18} className='text-red-600' />}
                  </div>
                  <div className='text-sm text-gray-600 mt-1'>
                    CR {note.context.crNo} • {note.context.meetingDate}
                  </div>
                </div>
              </button>

              {/* Details */}
              {isExpanded && (
                <div className='mt-4 space-y-4 border-t border-current border-opacity-20 pt-4'>
                  {/* Issues list */}
                  <div className='space-y-2'>
                    <h4 className='font-semibold text-sm'>Problèmes détectés :</h4>
                    {issues.map((issue, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-sm ${
                          issue.severity === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        <div className='font-medium'>{issue.message}</div>
                        {issue.suggested_fix && (
                          <div className='text-xs mt-1 opacity-90'>
                            💡 Suggestion: {issue.suggested_fix}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Editable fields */}
                  <div className='space-y-3 bg-white p-3 rounded'>
                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>
                        Description
                      </label>
                      <textarea
                        value={note.description}
                        onChange={(e) => {
                          note.description = e.target.value
                        }}
                        className='w-full px-2 py-1 border border-gray-300 rounded text-sm'
                        rows={2}
                      />
                    </div>

                    <div className='grid grid-cols-2 gap-3'>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>
                          Priorité
                        </label>
                        <select
                          value={note.priority}
                          onChange={(e) => {
                            note.priority = e.target.value as any
                          }}
                          className='w-full px-2 py-1 border border-gray-300 rounded text-sm'
                        >
                          <option value='low'>Basse</option>
                          <option value='medium'>Moyenne</option>
                          <option value='high'>Haute</option>
                        </select>
                      </div>

                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>
                          Statut
                        </label>
                        <select
                          value={note.status}
                          onChange={(e) => {
                            note.status = e.target.value as any
                          }}
                          className='w-full px-2 py-1 border border-gray-300 rounded text-sm'
                        >
                          <option value='à faire'>À faire</option>
                          <option value='en cours'>En cours</option>
                          <option value='retard'>Retard</option>
                          <option value='fait'>Fait</option>
                          <option value='obsolète'>Obsolète</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>
                        Délai (optionnel)
                      </label>
                      <input
                        type='date'
                        value={note.dueDate || ''}
                        onChange={(e) => {
                          note.dueDate = e.target.value || undefined
                        }}
                        className='w-full px-2 py-1 border border-gray-300 rounded text-sm'
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='flex gap-2 justify-end'>
                    <button
                      onClick={() => setEditingNote(null)}
                      className='px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50'
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleAccept(note.id)}
                      className='px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700'
                    >
                      Accepter sans correction
                    </button>
                    <button
                      onClick={() => handleCorrectAndAccept(note.id)}
                      className='px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700'
                    >
                      Corriger et accepter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
