import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Visit } from '../../types/visit'
import { RemarquesVisiteTable } from './RemarquesVisiteTable'
import { getAllNotes, getNotesByCrNo } from '../../lib/notes'
import { validateAllNotes, getErrorCount, getWarningCount } from '../../lib/inconsistencies'
import { getMeetings } from '../../lib/repo'

interface RemarquesVisiteProps {
  visit: Visit
  crNo: number
}

export function RemarquesVisite({ visit, crNo }: RemarquesVisiteProps) {
  const [showDetails, setShowDetails] = useState(false)

  const meetings = getMeetings()
  const currentMeeting = meetings.find(m => m.crNo === crNo)
  const meetingDate = currentMeeting?.date || new Date().toISOString().split('T')[0]

  const notesForThisCr = getNotesByCrNo(crNo)
  const inconsistencies = validateAllNotes()

  const totalErrors = getErrorCount(inconsistencies)
  const totalWarnings = getWarningCount(inconsistencies)
  const hasIssues = totalErrors > 0 || totalWarnings > 0

  const priorityColor: Record<string, string> = {
    'low': 'bg-gray-100 text-gray-800',
    'medium': 'bg-blue-100 text-blue-800',
    'high': 'bg-red-100 text-red-800'
  }

  const statusColor: Record<string, string> = {
    'à faire': 'bg-gray-100 text-gray-800',
    'en cours': 'bg-blue-100 text-blue-800',
    'retard': 'bg-red-100 text-red-800',
    'fait': 'bg-green-100 text-green-800',
    'obsolète': 'bg-gray-200 text-gray-600'
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold mb-2'>Remarques - CR N{crNo}</h1>
        <p className='text-gray-600'>
          Réunion du {meetingDate}
        </p>
      </div>

      {/* Issues alert */}
      {hasIssues && (
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3'>
          <AlertTriangle size={24} className='text-yellow-600 flex-shrink-0 mt-0.5' />
          <div>
            <h3 className='font-semibold text-yellow-900'>Incohérences détectées</h3>
            <p className='text-sm text-yellow-800 mt-1'>
              {totalErrors} erreur{totalErrors !== 1 ? 's' : ''} et {totalWarnings} avertissement{totalWarnings !== 1 ? 's' : ''} trouvés.
              Veuillez les corriger avant de finaliser la visite.
            </p>
            <a
              href='#correction'
              className='text-sm text-yellow-700 hover:text-yellow-900 font-medium mt-2 inline-block'
            >
              Aller à la correction →
            </a>
          </div>
        </div>
      )}

      {/* Notes table */}
      <RemarquesVisiteTable
        crNo={crNo}
        meetingDate={meetingDate}
        notes={notesForThisCr}
      />

      {/* Notes for this CR */}
      <div className='bg-white border border-gray-200 rounded-lg'>
        <div
          className='px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50'
          onClick={() => setShowDetails(!showDetails)}
        >
          <h2 className='font-semibold flex items-center justify-between'>
            <span>Remarques de cette visite</span>
            <span className='bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm font-medium'>
              {notesForThisCr.length}
            </span>
          </h2>
        </div>

        {showDetails && (
          <div className='divide-y divide-gray-200'>
            {notesForThisCr.length === 0 ? (
              <div className='px-4 py-8 text-center text-gray-500'>
                Aucune remarque pour cette visite
              </div>
            ) : (
              notesForThisCr.map(note => {
                const hasNoteIssues = inconsistencies.has(note.id)
                return (
                  <div key={note.id} className={`px-4 py-3 ${hasNoteIssues ? 'bg-yellow-50' : ''}`}>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-start gap-2'>
                          <span className='font-semibold text-gray-700 flex-shrink-0'>
                            {note.number}
                          </span>
                          <div className='flex-1 min-w-0'>
                            <p className='text-gray-900 break-words'>{note.description}</p>
                            <div className='flex flex-wrap gap-2 mt-2'>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColor[note.priority]}`}>
                                {note.priority === 'low' ? 'Basse' : note.priority === 'medium' ? 'Moyenne' : 'Haute'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[note.status]}`}>
                                {note.status}
                              </span>
                              {note.dueDate && (
                                <span className='px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800'>
                                  Délai: {note.dueDate}
                                </span>
                              )}
                              {hasNoteIssues && (
                                <span className='px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800'>
                                  ⚠️ À corriger
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Navigation hint */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900'>
        💡 <strong>Conseil:</strong> Après avoir créé vos remarques, consultez la page{' '}
        <a href='#tableur' className='font-semibold underline hover:no-underline'>
          Tableur
        </a>
        {' '}pour voir toutes les remarques de toutes les réunions, et la page{' '}
        <a href='#correction' className='font-semibold underline hover:no-underline'>
          Correction
        </a>
        {' '}pour valider et corriger les incohérences.
      </div>
    </div>
  )
}
