import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Plus, Upload, ChevronDown, ChevronRight, Check, Ban, Clock, MessageSquarePlus, Flag, X,
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

/**
 * Tableau des points de compte rendu (réserves + mémos), avec import Excel,
 * mise en couleur (rappels en rouge, dernière réunion en bleu gras), actions de
 * suivi (reporter / terminer / obsolète / commenter) et historique dépliable.
 * Vue unifiée sur le même modèle que les réserves — rien n'est dupliqué.
 */
export function CrTable() {
  const [reserves, setReserves] = useState<Reserve[]>(getReserves)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lots = useMemo(() => getLotsConfig(), [])
  const today = todayISO()

  const persist = (next: Reserve[]) => { setReserves(next); saveReserves(next) }

  // La « dernière réunion » = date de CR la plus récente présente dans les points.
  const latestMeetingDate = useMemo(() => {
    const dates = reserves.map(r => r.meetingDate).filter(Boolean) as string[]
    return dates.length ? dates.sort().at(-1) : undefined
  }, [reserves])

  // Tri : CR décroissant, puis rappels/ retards en tête.
  const rows = useMemo(() => {
    const rank = (r: Reserve) => {
      const { tone } = crState(r, today, latestMeetingDate)
      return tone === 'overdue' || tone === 'reminder' ? 0 : tone === 'reported' ? 1 : tone === 'done' || tone === 'obsolete' ? 3 : 2
    }
    return [...reserves].sort((a, b) =>
      rank(a) - rank(b) || (b.crNo ?? -1) - (a.crNo ?? -1) || (b.meetingDate ?? '').localeCompare(a.meetingDate ?? ''),
    )
  }, [reserves, today, latestMeetingDate])

  const lotLabel = (id: string) => lots.find(l => l.id === id)?.name ?? id

  const toggle = (id: string) => setOpen(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const follow = (r: Reserve, status: FollowUpStatus, opts: { dueDate?: string; note?: string } = {}) => {
    const f = { at: new Date().toISOString(), visitId: 'cr-table', visitDate: today, status, ...opts }
    persist(reserves.map(x => (x.id === r.id ? applyFollowUp(x, f) : x)))
    logActivity('doc', `CR ${r.number} — ${FOLLOW_LABEL[status]}`)
  }

  const report = (r: Reserve, weeks: number) =>
    follow(r, 'rescheduled', { dueDate: addWeeks(weeks), note: `Reporté de ${weeks} sem.` })

  const comment = (r: Reserve) => {
    const note = window.prompt('Réponse / commentaire à ajouter :')?.trim()
    if (note) follow(r, 'comment', { note })
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
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => setAdding(a => !a)} style={{ ...ghostBtn, borderColor: 'var(--navy)', color: 'var(--navy)' }}>
          <Plus size={14} /> Ajouter un point
        </button>
        <button onClick={() => fileRef.current?.click()} style={ghostBtn}>
          <Upload size={14} /> Importer un Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '10.5px', color: 'var(--muted)', marginBottom: '10px' }}>
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

      <div style={sectionLabel}>Points de CR ({rows.length})</div>
      {rows.length === 0 && <Empty>Aucun point. Ajoutez-en un ou importez un CR Excel.</Empty>}

      <div style={{ overflowX: 'auto', border: rows.length ? '1px solid var(--line)' : 'none', borderRadius: '10px' }}>
        {rows.length > 0 && (
          <div style={{ minWidth: '640px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: HEAD_COLS, gap: '8px', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid var(--line)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)' }}>
              <span>CR</span><span>Point</span><span>Lot / Entreprise</span><span>Type</span><span>Échéance</span><span>Statut</span>
            </div>
            {rows.map(r => {
              const { tone, lastMeeting } = crState(r, today, latestMeetingDate)
              const ts = TONE_STYLE[tone]
              const expanded = open.has(r.id)
              const emphasize = lastMeeting && tone === 'normal'
              return (
                <div key={r.id} style={{ borderBottom: '1px solid #eef2f6', background: ts.bg }}>
                  <div onClick={() => toggle(r.id)} style={{ display: 'grid', gridTemplateColumns: HEAD_COLS, gap: '8px', padding: '9px 12px', cursor: 'pointer', alignItems: 'center', fontSize: '12px' }}>
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
                    <div style={{ padding: '4px 12px 14px 30px', background: '#fff' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
                        {r.number}{r.meetingDate ? ` · réunion du ${frDate(r.meetingDate)}` : ''}{r.reminder ? ' · rappel' : ''}
                      </div>
                      {/* Historique dépliable */}
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
                      {/* Actions */}
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
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
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
