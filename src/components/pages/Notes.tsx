import { useMemo, useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { getReserves, getLotsConfig } from '../../lib/repo'
import { input, ghostBtn } from '../visite/visiteStyles'

const frDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

const STATUS_TONE: Record<string, { color: string; bg: string }> = {
  done: { color: '#15803d', bg: '#dcfce7' },
  in_progress: { color: '#dc2626', bg: '#fef3c7' },
  rescheduled: { color: '#b45309', bg: '#fed7aa' },
  comment: { color: '#0369a1', bg: '#e0f2fe' },
  obsolete: { color: '#64748b', bg: '#f1f5f9' },
  not_done: { color: '#6b7280', bg: '#f3f4f6' },
}

export function Notes() {
  const reserves = useMemo(() => getReserves(), [])
  const lots = useMemo(() => getLotsConfig(), [])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())

  // ── URL state sync: read from URL on mount ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const searchParam = params.get('notesSearch')
    if (searchParam) setSearchTerm(decodeURIComponent(searchParam))
    const statusParam = params.get('notesStatus')
    if (statusParam) setStatusFilter(new Set(statusParam.split(',')))
  }, [])

  // ── URL state sync: update URL when state changes ───────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (searchTerm) params.set('notesSearch', encodeURIComponent(searchTerm))
    else params.delete('notesSearch')
    if (statusFilter.size > 0) params.set('notesStatus', Array.from(statusFilter).join(','))
    else params.delete('notesStatus')
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }, [searchTerm, statusFilter])

  // Flatten all notes across all reserves
  const allNotes = useMemo(() => {
    const notes: Array<{
      id: string
      reserveNo: string
      lotId: string
      status: string
      visitDate: string
      dueDate?: string
      note?: string
      description: string
    }> = []
    reserves.forEach(r => {
      if (r.follow && r.follow.length > 0) {
        r.follow.forEach((f, idx) => {
          notes.push({
            id: `${r.id}-${idx}`,
            reserveNo: r.number,
            lotId: r.lotId,
            status: f.status,
            visitDate: f.visitDate,
            dueDate: f.dueDate,
            note: f.note,
            description: r.description,
          })
        })
      }
    })
    return notes
  }, [reserves])

  // Filter and sort
  const filtered = useMemo(() => {
    let result = allNotes
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(n =>
        n.description.toLowerCase().includes(term) ||
        lots.find(l => l.id === n.lotId)?.name.toLowerCase().includes(term) ||
        (n.note || '').toLowerCase().includes(term)
      )
    }
    if (statusFilter.size > 0) {
      result = result.filter(n => statusFilter.has(n.status))
    }
    return result.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
  }, [allNotes, searchTerm, lots, statusFilter])

  const lotLabel = (id: string) => lots.find(l => l.id === id)?.name ?? id

  const statuses = ['done', 'in_progress', 'rescheduled', 'comment', 'obsolete', 'not_done'] as const
  const statusLabels: Record<string, string> = {
    done: 'Résolu',
    in_progress: 'En cours',
    rescheduled: 'Reprogrammé',
    comment: 'Commentaire',
    obsolete: 'Obsolète',
    not_done: 'Non résolu',
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Search bar */}
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

      {/* Status filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', paddingLeft: '8px' }}>
        {statuses.map(status => {
          const isSelected = statusFilter.has(status)
          const tone = STATUS_TONE[status]
          return (
            <button
              key={status}
              onClick={() => {
                const next = new Set(statusFilter)
                if (isSelected) next.delete(status)
                else next.add(status)
                setStatusFilter(next)
              }}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: isSelected ? `2px solid ${tone.color}` : '1px solid var(--line)',
                background: isSelected ? tone.bg : '#fff',
                color: tone.color,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {statusLabels[status]}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px', paddingLeft: '8px' }}>
        {filtered.length} note{filtered.length !== 1 ? 's' : ''} trouvée{filtered.length !== 1 ? 's' : ''}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          Aucune note de suivi pour l'instant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(n => {
            const tone = STATUS_TONE[n.status] || STATUS_TONE.not_done
            return (
              <div
                key={n.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  background: tone.bg,
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: tone.color, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                      {n.reserveNo} · {lotLabel(n.lotId)}
                    </div>
                    <div style={{ marginTop: '2px', color: 'var(--navy)', fontWeight: 500 }}>
                      {n.description}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                  {frDate(n.visitDate)}{n.dueDate ? ` · Échéance: ${frDate(n.dueDate)}` : ''}
                </div>
                {n.note && (
                  <div style={{ fontSize: '11px', color: 'var(--navy)', fontStyle: 'italic', marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${tone.color}33` }}>
                    "{n.note}"
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
