import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Plus, Upload, ChevronDown, ChevronRight, Check, Ban, Clock, MessageSquarePlus, Flag, X, Pencil,
  LayoutList, Layers, Search,
} from 'lucide-react'
import {
  Reserve, ReserveKind, reserveKind, nextReserveNumber, applyFollowUp, crState,
  type FollowUpStatus,
} from '../../lib/reserves'
import { getReserves, saveReserves, getLotsConfig, logActivity } from '../../lib/repo'
import { sectionLabel, input, ghostBtn } from '../visite/visiteStyles'
import { Empty } from '../visite/visiteBits'

const todayISO = () => new Date().toISOString().slice(0, 10)
const addWeeks = (weeks: number) => {
  const d = new Date(); d.setDate(d.getDate() + weeks * 7); return d.toISOString().slice(0, 10)
}
const frDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

const TONE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  normal: { color: '#42607d', bg: 'transparent', label: '' },
  reminder: { color: '#dc2626', bg: '#fdecec', label: 'Rappel' },
  overdue: { color: '#dc2626', bg: '#fdecec', label: 'En retard' },
  reported: { color: '#b45309', bg: '#fff7ed', label: 'Reporté' },
  done: { color: '#15803d', bg: '#dcfce7', label: 'Terminé' },
  obsolete: { color: '#8595a6', bg: '#f1f5f9', label: 'Obsolète' },
}

const FOLLOW_LABEL: Record<FollowUpStatus, string> = {
  done: 'Terminé', in_progress: 'En cours', not_done: 'Non fait',
  rescheduled: 'Reporté', obsolete: 'Rendu obsolète', comment: 'Commentaire',
}

export function CrTable() {
  const [reserves, setReserves] = useState<Reserve[]>(getReserves)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [view, setView] = useState<'liste' | 'par-lot'>('liste')
  const [selectedCr, setSelectedCr] = useState<number | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const lots = useMemo(() => getLotsConfig(), [])
  const today = todayISO()

  const persist = (next: Reserve[]) => { setReserves(next); saveReserves(next) }

  const latestMeetingDate = useMemo(() => {
    const dates = reserves.map(r => r.meetingDate).filter(Boolean) as string[]
    return dates.length ? dates.sort().at(-1) : undefined
  }, [reserves])

  // All unique CR numbers (for navigation chips)
  const crNumbers = useMemo(() => {
    const nums = [...new Set(reserves.filter(r => r.crNo != null).map(r => r.crNo!))]
    return nums.sort((a, b) => a - b)
  }, [reserves])

  // Current "active" CR number — used when closing a reserve without a meeting
  const currentCrNo = useMemo(() => crNumbers.length ? Math.max(...crNumbers) : 1, [crNumbers])

  const rows = useMemo(() => {
    const rank = (r: Reserve) => {
      const { tone } = crState(r, today, latestMeetingDate)
      return tone === 'overdue' || tone === 'reminder' ? 0 : tone === 'reported' ? 1 : tone === 'done' || tone === 'obsolete' ? 3 : 2
    }
    return [...reserves].sort((a, b) =>
      rank(a) - rank(b) || (b.crNo ?? -1) - (a.crNo ?? -1) || (b.meetingDate ?? '').localeCompare(a.meetingDate ?? ''),
    )
  }, [reserves, today, latestMeetingDate])

  // Filtered to selected CR (null = all) and search term
  const filteredRows = useMemo(() => {
    let result = selectedCr !== null ? rows.filter(r => r.crNo === selectedCr) : rows
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(r =>
        r.description.toLowerCase().includes(term) ||
        r.lotId.toLowerCase().includes(term) ||
        (r.company || '').toLowerCase().includes(term) ||
        r.number.toLowerCase().includes(term)
      )
    }
    return result
  }, [rows, selectedCr, searchTerm])

  const lotLabel = (id: string) => lots.find(l => l.id === id)?.name ?? id

  const toggle = (id: string) => setOpen(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const follow = (r: Reserve, status: FollowUpStatus, opts: { dueDate?: string; note?: string } = {}) => {
    const f = { at: new Date().toISOString(), visitId: 'cr-table', visitDate: today, status, ...opts }
    let updated = applyFollowUp(r, f)
    // Attribute current CR number when closing a reserve without one
    if ((status === 'done' || status === 'obsolete') && r.crNo == null) {
      updated = { ...updated, crNo: currentCrNo }
    }
    persist(reserves.map(x => (x.id === r.id ? updated : x)))
    logActivity('doc', `CR ${r.number} — ${FOLLOW_LABEL[status]}`)
  }

  const report = (r: Reserve, weeks: number) =>
    follow(r, 'rescheduled', { dueDate: addWeeks(weeks), note: `Reporté de ${weeks} sem.` })

  const comment = (r: Reserve) => {
    const note = window.prompt('Réponse / commentaire à ajouter :')?.trim()
    if (note) follow(r, 'comment', { note })
  }

  const updateReserve = (id: string, patch: Partial<Reserve>) => {
    persist(reserves.map(x => x.id === id ? { ...x, ...patch } : x))
    setEditing(null)
  }

  const addRow = (draft: Draft) => {
    const rv: Reserve = {
      id: `cr${Date.now()}${Math.floor(Math.random() * 1000)}`,
      number: nextReserveNumber(reserves),
      lotId: draft.lotId, logementId: '', description: draft.description.trim(),
      priority: draft.reminder ? 'high' : 'medium', status: 'open',
      createdAt: new Date().toISOString(), company: draft.company.trim() || undefined,
      kind: draft.kind, dueDate: draft.dueDate || undefined,
      crNo: draft.crNo ? Number(draft.crNo) : undefined,
      meetingDate: draft.meetingDate || undefined, reminder: draft.reminder || undefined,
    }
    persist([rv, ...reserves]); setAdding(false)
  }

  const onImport = async (file: File) => {
    setNotice(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const imported = raw.map((row, i) => rowToReserve(row, i, reserves.length)).filter((x): x is Reserve => x !== null)
      if (imported.length === 0) { setNotice('Aucune ligne exploitable. Colonnes attendues : N°CR, Remarque, Entreprise, Lot, Type, Échéance, Date réunion.'); return }
      persist([...imported, ...reserves])
      logActivity('doc', `Import CR : ${imported.length} point${imported.length > 1 ? 's' : ''} ajouté${imported.length > 1 ? 's' : ''}`)
      setNotice(`${imported.length} point(s) importé(s).`)
    } catch {
      setNotice("Fichier illisible. Utilisez un .xlsx avec une ligne d'en-têtes.")
    }
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setAdding(a => !a)} style={{ ...ghostBtn, borderColor: 'var(--navy)', color: 'var(--navy)' }}>
          <Plus size={14} /> Ajouter un point
        </button>
        <button onClick={() => fileRef.current?.click()} style={ghostBtn}>
          <Upload size={14} /> Importer un Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
        <div style={{ flex: 1 }} />
        {/* View toggle */}
        <div style={{ display: 'flex', gap: '2px', background: '#eef2f6', padding: '2px', borderRadius: '7px' }}>
          <button onClick={() => setView('liste')} title="Vue liste" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: view === 'liste' ? '#fff' : 'transparent', color: view === 'liste' ? '#02457A' : '#5b7183' }}>
            <LayoutList size={13} /> Liste
          </button>
          <button onClick={() => setView('par-lot')} title="Vue par lot" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: view === 'par-lot' ? '#fff' : 'transparent', color: view === 'par-lot' ? '#02457A' : '#5b7183' }}>
            <Layers size={13} /> Par lot
          </button>
        </div>
      </div>

      {/* CR navigation chips */}
      {crNumbers.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button
            onClick={() => setSelectedCr(null)}
            style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--line)', background: selectedCr === null ? '#02457A' : '#fff', color: selectedCr === null ? '#fff' : 'var(--navy)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            Tous
          </button>
          {crNumbers.map(n => (
            <button
              key={n}
              onClick={() => setSelectedCr(selectedCr === n ? null : n)}
              style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--line)', background: selectedCr === n ? '#02457A' : '#fff', color: selectedCr === n ? '#fff' : 'var(--navy)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              CR {n}
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginBottom: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <span><b style={{ color: '#dc2626' }}>Rouge</b> : rappel / en retard</span>
        <span><b style={{ color: '#018ABE' }}>Bleu gras</b> : évoqué à la dernière réunion</span>
        <span><b style={{ color: '#b45309' }}>Orange</b> : reporté</span>
      </div>

      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '9px', background: '#eef4fb', border: '1px solid #d3e3f2', color: '#274b6b', fontSize: '12px', marginBottom: '12px' }}>
          {notice}<button onClick={() => setNotice(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#274b6b', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {adding && <AddForm lots={lots} onCancel={() => setAdding(false)} onAdd={addRow} />}

      {/* Search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '0 8px' }}>
        <Search size={16} color="var(--muted)" />
        <input
          type="text"
          placeholder="Rechercher une remarque…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ ...input, flex: 1, fontSize: '13px', padding: '8px 10px' }}
        />
        {searchTerm && <button onClick={() => setSearchTerm('')} style={{ ...ghostBtn, padding: '6px 8px' }}><X size={14} /></button>}
      </div>

      <div style={sectionLabel}>Points de CR ({filteredRows.length})</div>
      {filteredRows.length === 0 && <Empty>Aucun point. Ajoutez-en un ou importez un CR Excel.</Empty>}

      {/* ── Vue liste (default) ────────────────────────────────────────────── */}
      {view === 'liste' && filteredRows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '10px' }}>
          <div style={{ minWidth: '640px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: HEAD_COLS, gap: '8px', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid var(--line)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)' }}>
              <span>CR</span><span>Point</span><span>Lot / Entreprise</span><span>Type</span><span>Échéance</span><span>Statut</span>
            </div>
            {filteredRows.map(r => {
              const { tone, lastMeeting } = crState(r, today, latestMeetingDate)
              const ts = TONE_STYLE[tone]
              const expanded = open.has(r.id)
              const emphasize = lastMeeting && tone === 'normal'
              const isEditing = editing === r.id
              return (
                <div key={r.id} style={{ borderBottom: '1px solid #eef2f6', background: ts.bg }}>
                  <div onClick={() => { if (!isEditing) toggle(r.id) }} style={{ display: 'grid', gridTemplateColumns: HEAD_COLS, gap: '8px', padding: '9px 12px', cursor: 'pointer', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: emphasize ? '#018ABE' : 'var(--navy)' }}>
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      {r.crNo != null ? `#${r.crNo}` : '—'}
                    </span>
                    <span style={{ color: emphasize ? '#018ABE' : (tone === 'normal' ? 'var(--ink, #1f2937)' : ts.color), fontWeight: emphasize || tone === 'reminder' ? 700 : 400 }}>
                      {r.reminder && <Flag size={11} color="#dc2626" style={{ verticalAlign: '-1px', marginRight: '4px' }} />}
                      {r.description}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>{r.company || lotLabel(r.lotId)}</span>
                    <span style={{ color: 'var(--muted)' }}>{reserveKind(r) === 'action' ? 'Action' : 'Info'}</span>
                    <span style={{ color: tone === 'overdue' ? '#dc2626' : 'var(--muted)', fontWeight: tone === 'overdue' ? 700 : 400 }}>{frDate(r.dueDate)}</span>
                    <span>{ts.label && <span style={{ fontSize: '10px', fontWeight: 700, color: ts.color, background: '#fff', border: `1px solid ${ts.color}33`, borderRadius: '999px', padding: '2px 8px' }}>{ts.label}</span>}</span>
                  </div>

                  {expanded && (
                    isEditing ? (
                      <div style={{ padding: '8px 12px 14px 30px', background: '#f8fafc' }}>
                        <EditForm
                          reserve={r}
                          lots={lots}
                          onSave={patch => updateReserve(r.id, patch)}
                          onCancel={() => setEditing(null)}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: '4px 12px 14px 30px', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', flex: 1 }}>
                            {r.number}{r.meetingDate ? ` · réunion du ${frDate(r.meetingDate)}` : ''}{r.reminder ? ' · rappel' : ''}
                          </div>
                          <button onClick={() => setEditing(r.id)} title="Modifier ce point" style={{ ...ghostBtn, padding: '4px 8px', fontSize: '11px' }}>
                            <Pencil size={12} /> Modifier
                          </button>
                        </div>
                        {(r.follow?.length ?? 0) > 0 ? (
                          <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {r.follow!.map((f, i) => (
                              <div key={i} style={{ fontSize: '11.5px', color: '#42607d' }}>
                                <b>{frDate(f.visitDate)}</b> — {FOLLOW_LABEL[f.status]}{f.dueDate ? ` (→ ${frDate(f.dueDate)})` : ''}{f.note ? ` : ${f.note}` : ''}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>Aucun suivi pour l'instant.</div>
                        )}
                        {r.status === 'open' && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            <button onClick={() => follow(r, 'done')} style={{ ...ghostBtn, borderColor: '#a7f3d0', color: '#047857' }}><Check size={13} /> Terminé</button>
                            <button onClick={() => report(r, 1)} style={{ ...ghostBtn, borderColor: '#fed7aa', color: '#b45309' }}><Clock size={13} /> +1 sem</button>
                            <button onClick={() => report(r, 2)} style={{ ...ghostBtn, borderColor: '#fed7aa', color: '#b45309' }}><Clock size={13} /> +2 sem</button>
                            <button onClick={() => report(r, 4)} style={{ ...ghostBtn, borderColor: '#fed7aa', color: '#b45309' }}><Clock size={13} /> +4 sem</button>
                            <button onClick={() => comment(r)} style={ghostBtn}><MessageSquarePlus size={13} /> Commenter</button>
                            <button onClick={() => follow(r, 'obsolete')} style={{ ...ghostBtn, borderColor: '#e2e8f0', color: '#64748b' }}><Ban size={13} /> Obsolète</button>
                          </div>
                        )}
                        {r.status !== 'open' && (
                          <button onClick={() => follow(r, 'in_progress', { note: 'Réouvert' })} style={ghostBtn}>Rouvrir</button>
                        )}
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Vue par lot ────────────────────────────────────────────────────── */}
      {view === 'par-lot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {lots.filter(l => filteredRows.some(r => r.lotId === l.id)).map(lot => {
            const lotRows = filteredRows.filter(r => r.lotId === lot.id)
            const obs = lotRows.filter(r => reserveKind(r) === 'observation')
            const actions = lotRows.filter(r => reserveKind(r) === 'action')
            return (
              <div key={lot.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#f0f4f8', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#02457A' }}>{lot.name}</div>
                  {lot.company && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{lot.company}</div>}
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lotRows.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>—</div>}
                  {actions.map(r => {
                    const { tone } = crState(r, today, latestMeetingDate)
                    const ts = TONE_STYLE[tone]
                    const isEditing = editing === r.id
                    return (
                      <div key={r.id} style={{ borderRadius: '8px', border: `1px solid ${tone === 'overdue' || tone === 'reminder' ? '#fca5a5' : '#fde68a'}`, background: tone === 'overdue' || tone === 'reminder' ? '#fff5f5' : '#fffbeb', padding: '8px 10px' }}>
                        {isEditing ? (
                          <EditForm reserve={r} lots={lots} onSave={patch => updateReserve(r.id, patch)} onCancel={() => setEditing(null)} />
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <Flag size={12} color="#b45309" style={{ flexShrink: 0, marginTop: '1px' }} />
                              <span style={{ flex: 1, fontSize: '12px', fontWeight: tone === 'reminder' || tone === 'overdue' ? 700 : 600, color: ts.color !== 'transparent' ? ts.color : '#1f2937' }}>
                                {r.description}
                              </span>
                              <button onClick={() => setEditing(r.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 2px', fontSize: 12 }}><Pencil size={12} /></button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '10px', color: 'var(--muted)' }}>
                              {r.crNo && <span>CR {r.crNo}</span>}
                              {r.dueDate && <span>Échéance : {frDate(r.dueDate)}</span>}
                              {ts.label && <span style={{ color: ts.color, fontWeight: 700 }}>{ts.label}</span>}
                            </div>
                            {r.status === 'open' && (
                              <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
                                <button onClick={() => follow(r, 'done')} style={{ ...ghostBtn, padding: '3px 8px', fontSize: '10px', borderColor: '#a7f3d0', color: '#047857' }}><Check size={10} /> Terminé</button>
                                <button onClick={() => follow(r, 'obsolete')} style={{ ...ghostBtn, padding: '3px 8px', fontSize: '10px', color: '#64748b' }}><Ban size={10} /> Obsolète</button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                  {obs.map(r => {
                    const { tone } = crState(r, today, latestMeetingDate)
                    const ts = TONE_STYLE[tone]
                    const isEditing = editing === r.id
                    return (
                      <div key={r.id} style={{ borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px 10px' }}>
                        {isEditing ? (
                          <EditForm reserve={r} lots={lots} onSave={patch => updateReserve(r.id, patch)} onCancel={() => setEditing(null)} />
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <span style={{ flex: 1, fontSize: '12px', color: ts.color !== 'transparent' ? ts.color : '#42607d' }}>{r.description}</span>
                              <button onClick={() => setEditing(r.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 2px' }}><Pencil size={12} /></button>
                            </div>
                            {r.crNo && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>CR {r.crNo}</div>}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {filteredRows.filter(r => !r.lotId || !lots.some(l => l.id === r.lotId)).length > 0 && (
            <div style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#f0f4f8', borderBottom: '1px solid var(--line)', fontSize: '13px', fontWeight: 700, color: '#02457A' }}>Sans lot</div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredRows.filter(r => !r.lotId || !lots.some(l => l.id === r.lotId)).map(r => (
                  <div key={r.id} style={{ fontSize: '12px', color: 'var(--ink)' }}>— {r.description}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const HEAD_COLS = '52px 1fr 130px 60px 90px 84px'

interface Draft { crNo: string; meetingDate: string; description: string; lotId: string; company: string; kind: ReserveKind; dueDate: string; reminder: boolean }

function AddForm({ lots, onAdd, onCancel }: { lots: { id: string; name: string }[]; onAdd: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>({ crNo: '', meetingDate: todayISO(), description: '', lotId: lots[0]?.id ?? '', company: '', kind: 'action', dueDate: '', reminder: false })
  const set = (patch: Partial<Draft>) => setD(prev => ({ ...prev, ...patch }))
  return (
    <div style={{ padding: '13px', borderRadius: '11px', border: '1px solid var(--line)', background: '#f8fafc', marginBottom: '14px' }}>
      <div style={sectionLabel}>Nouveau point de CR</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input value={d.crNo} onChange={e => set({ crNo: e.target.value.replace(/\D/g, '') })} placeholder="N° CR" style={input} />
        <input type="date" value={d.meetingDate} onChange={e => set({ meetingDate: e.target.value })} style={input} />
      </div>
      <textarea value={d.description} onChange={e => set({ description: e.target.value })} placeholder="Remarque / note" rows={2} style={{ ...input, width: '100%', resize: 'vertical', marginBottom: '8px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <select value={d.lotId} onChange={e => set({ lotId: e.target.value })} style={input}>
          <option value="">— Lot —</option>
          {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input value={d.company} onChange={e => set({ company: e.target.value })} placeholder="Entreprise" style={input} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <select value={d.kind} onChange={e => set({ kind: e.target.value as ReserveKind })} style={input}>
          <option value="action">Pour action</option>
          <option value="observation">Pour info</option>
        </select>
        <input type="date" value={d.dueDate} onChange={e => set({ dueDate: e.target.value })} style={input} title="Échéance" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--navy)', marginBottom: '10px' }}>
        <input type="checkbox" checked={d.reminder} onChange={e => set({ reminder: e.target.checked })} style={{ accentColor: '#dc2626' }} />
        Rappel / mémo important (mis en rouge)
      </label>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={ghostBtn}>Annuler</button>
        <button disabled={!d.description.trim()} onClick={() => onAdd(d)} style={{ ...ghostBtn, borderColor: 'var(--navy)', color: 'var(--navy)', opacity: d.description.trim() ? 1 : 0.5 }}>Ajouter</button>
      </div>
    </div>
  )
}

// ── Inline edit form ─────────────────────────────────────────────────────────

function EditForm({ reserve, lots, onSave, onCancel }: {
  reserve: Reserve
  lots: { id: string; name: string }[]
  onSave: (patch: Partial<Reserve>) => void
  onCancel: () => void
}) {
  const [desc, setDesc] = useState(reserve.description)
  const [company, setCompany] = useState(reserve.company ?? '')
  const [lotId, setLotId] = useState(reserve.lotId)
  const [dueDate, setDueDate] = useState(reserve.dueDate ?? '')
  const [crNo, setCrNo] = useState(reserve.crNo != null ? String(reserve.crNo) : '')
  const [meetingDate, setMeetingDate] = useState(reserve.meetingDate ?? '')
  const [kind, setKind] = useState<ReserveKind>(reserveKind(reserve))
  const [reminder, setReminder] = useState(reserve.reminder ?? false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <textarea
        autoFocus
        value={desc}
        onChange={e => setDesc(e.target.value)}
        rows={2}
        style={{ ...input, width: '100%', resize: 'vertical', fontSize: '12px' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
        <select value={lotId} onChange={e => setLotId(e.target.value)} style={{ ...input, fontSize: '12px' }}>
          <option value="">— Lot —</option>
          {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Entreprise" style={{ ...input, fontSize: '12px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}>
        <select value={kind} onChange={e => setKind(e.target.value as ReserveKind)} style={{ ...input, fontSize: '12px' }}>
          <option value="action">Pour action</option>
          <option value="observation">Pour info</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)' }}>
          N° CR
          <input value={crNo} onChange={e => setCrNo(e.target.value.replace(/\D/g, ''))} placeholder="0" style={{ ...input, fontSize: '12px', width: '60px' }} />
        </label>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} title="Échéance" style={{ ...input, fontSize: '12px' }} />
      </div>
      <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} title="Date réunion" style={{ ...input, fontSize: '12px' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--navy)' }}>
        <input type="checkbox" checked={reminder} onChange={e => setReminder(e.target.checked)} style={{ accentColor: '#dc2626' }} />
        Rappel important
      </label>
      <div style={{ display: 'flex', gap: '7px' }}>
        <button
          onClick={() => onSave({
            description: desc.trim(), company: company.trim() || undefined, lotId,
            dueDate: dueDate || undefined, crNo: crNo ? Number(crNo) : undefined,
            meetingDate: meetingDate || undefined, kind, reminder: reminder || undefined,
            priority: reminder ? 'high' : 'medium',
          })}
          disabled={!desc.trim()}
          style={{ ...ghostBtn, borderColor: 'var(--navy)', color: 'var(--navy)', fontWeight: 700, opacity: desc.trim() ? 1 : 0.5 }}
        >
          <Check size={13} /> Enregistrer
        </button>
        <button onClick={onCancel} style={ghostBtn}>Annuler</button>
      </div>
    </div>
  )
}

// ── Import Excel : mapping souple des en-têtes ───────────────────────────────

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(norm(k))) {
      const v = row[k]
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      return String(v ?? '').trim()
    }
  }
  return ''
}

function rowToReserve(row: Record<string, unknown>, i: number, offset: number): Reserve | null {
  const description = pick(row, ['remarque', 'description', 'note', 'observation', 'objet', 'point', 'libelle'])
  if (!description) return null
  const crNoRaw = pick(row, ['ncr', 'nocr', 'numerocr', 'cr', 'numero', 'no', 'ndecr'])
  const typeRaw = norm(pick(row, ['type', 'action', 'nature', 'categorie']))
  const statusRaw = norm(pick(row, ['statut', 'status', 'etat']))
  const kind: ReserveKind = /(action|afaire|pa|pouraction)/.test(typeRaw) ? 'action' : typeRaw ? 'observation' : 'action'
  const reminder = /(rappel|memo|important|pi)/.test(typeRaw) || /(rappel|memo)/.test(statusRaw)
  return {
    id: `cr${Date.now()}${i}${Math.floor(Math.random() * 1000)}`,
    number: `R-${String(offset + i + 1).padStart(3, '0')}`,
    lotId: pick(row, ['lot', 'codelot']),
    logementId: '',
    description,
    priority: reminder ? 'high' : 'medium',
    status: /(fait|termine|solde|done|resolu)/.test(statusRaw) ? 'resolved' : 'open',
    createdAt: new Date().toISOString(),
    company: pick(row, ['entreprise', 'societe', 'responsable', 'intervenant']) || undefined,
    kind,
    dueDate: pick(row, ['echeance', 'datelimite', 'delai', 'due', 'pourle']) || undefined,
    crNo: crNoRaw ? Number(crNoRaw.replace(/\D/g, '')) || undefined : undefined,
    meetingDate: pick(row, ['datereunion', 'datedereunion', 'date', 'datevisite', 'datecr']) || undefined,
    reminder: reminder || undefined,
  }
}
