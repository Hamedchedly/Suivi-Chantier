import { useMemo, useState } from 'react'
import { Search, X, MessageSquare, Calendar, Tag } from 'lucide-react'
import { getReserves, getLotsConfig } from '../../lib/repo'
import { sectionLabel, input, ghostBtn } from '../visite/visiteStyles'
import { Empty } from '../visite/visiteBits'

const frDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

export function Notes() {
  const reserves = useMemo(() => getReserves(), [])
  const lots = useMemo(() => getLotsConfig(), [])
  const [searchTerm, setSearchTerm] = useState('')

  // Flatten all follow-up notes from all reserves
  const allNotes = useMemo(() => {
    const notes: Array<{
      id: string
      reserveId: string
      reserveNum: string
      reserveDesc: string
      lotName: string
      followUp: { at: string; visitDate: string; status: string; note?: string; dueDate?: string }
      tone: 'normal' | 'action' | 'done' | 'reported'
    }> = []

    reserves.forEach(r => {
      (r.follow ?? []).forEach(f => {
        let tone: 'normal' | 'action' | 'done' | 'reported' = 'normal'
        if (f.status === 'done' || f.status === 'obsolete') tone = 'done'
        else if (f.status === 'rescheduled') tone = 'reported'
        else if (f.status === 'in_progress' || f.status === 'not_done') tone = 'action'

        notes.push({
          id: `${r.id}-${f.at}`,
          reserveId: r.id,
          reserveNum: r.number,
          reserveDesc: r.description,
          lotName: lots.find(l => l.id === r.lotId)?.name ?? r.lotId,
          followUp: f,
          tone,
        })
      })
    })

    return notes.sort((a, b) => new Date(b.followUp.visitDate).getTime() - new Date(a.followUp.visitDate).getTime())
  }, [reserves, lots])

  const filteredNotes = useMemo(() => {
    if (!searchTerm.trim()) return allNotes
    const term = searchTerm.toLowerCase()
    return allNotes.filter(n =>
      n.reserveDesc.toLowerCase().includes(term) ||
      n.lotName.toLowerCase().includes(term) ||
      (n.followUp.note?.toLowerCase() ?? '').includes(term) ||
      n.reserveNum.toLowerCase().includes(term)
    )
  }, [allNotes, searchTerm])

  const TONE_COLOR: Record<string, { bg: string; border: string; label: string }> = {
    normal: { bg: '#f1f5f9', border: '#e2e8f0', label: '' },
    action: { bg: '#fef3c7', border: '#fcd34d', label: 'À faire' },
    done: { bg: '#dcfce7', border: '#86efac', label: 'Terminé' },
    reported: { bg: '#fed7aa', border: '#fdba74', label: 'Reporté' },
  }

  const FOLLOW_COLOR: Record<string, string> = {
    done: '#15803d',
    in_progress: '#018ABE',
    not_done: '#dc2626',
    rescheduled: '#b45309',
    obsolete: '#8595a6',
    comment: '#5b7183',
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <div style={sectionLabel}>Notes & suivi ({filteredNotes.length})</div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '0 8px' }}>
        <Search size={16} color="var(--muted)" />
        <input
          type="text"
          placeholder="Rechercher une note…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ ...input, flex: 1, fontSize: '13px', padding: '8px 10px' }}
        />
        {searchTerm && <button onClick={() => setSearchTerm('')} style={{ ...ghostBtn, padding: '6px 8px' }}><X size={14} /></button>}
      </div>

      {filteredNotes.length === 0 && <Empty>Aucune note. Les suivis des réserves apparaîtront ici.</Empty>}

      {/* Notes grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredNotes.map(note => {
          const tc = TONE_COLOR[note.tone]
          const fc = FOLLOW_COLOR[note.followUp.status]
          return (
            <div
              key={note.id}
              style={{
                border: `1px solid ${tc.border}`,
                background: tc.bg,
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Header: reserve info + status */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', marginBottom: '2px' }}>
                    {note.reserveNum}
                  </div>
                  <div style={{ fontSize: '13px', color: '#1f2937', lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {note.reserveDesc}
                  </div>
                </div>
                {tc.label && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: fc,
                    background: '#fff',
                    border: `1px solid ${fc}33`,
                    borderRadius: '999px',
                    padding: '3px 9px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {tc.label}
                  </span>
                )}
              </div>

              {/* Lot + date */}
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#5b7183', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Tag size={12} />
                  {note.lotName}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  {frDate(note.followUp.visitDate)}
                </span>
              </div>

              {/* Note text + due date */}
              {(note.followUp.note || note.followUp.dueDate) && (
                <div style={{ borderTop: `1px solid ${tc.border}`, paddingTop: '8px' }}>
                  {note.followUp.note && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', marginBottom: note.followUp.dueDate ? '6px' : 0 }}>
                      <MessageSquare size={13} style={{ flexShrink: 0, marginTop: '2px', color: fc }} />
                      <span style={{ color: '#1f2937', lineHeight: 1.35 }}>{note.followUp.note}</span>
                    </div>
                  )}
                  {note.followUp.dueDate && (
                    <div style={{ fontSize: '11px', color: fc, fontWeight: 600 }}>
                      Prévu pour : {frDate(note.followUp.dueDate)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
