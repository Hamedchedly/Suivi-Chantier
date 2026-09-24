import { useMemo, useRef, useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  Plus, Upload, Check, Ban, Clock, MessageSquarePlus, Flag, X, Pencil,
  Layers, Building2, CalendarClock, Search, Eye, EyeOff, Printer, Download, Lock, Unlock, FileOutput,
} from 'lucide-react'
import {
  Reserve, ReserveKind, ReservePriority, reserveKind, nextReserveNumber, applyFollowUp, crState,
  getReserveCompanies, getReserveLots, getReserveLocations, isArchivedAt, isNewOrModifiedAt,
  type FollowUpStatus,
} from '../../lib/reserves'
import { getReserves, saveReserves, getLotsConfig, getZoneRefs, logActivity } from '../../lib/repo'
import type { ZoneRef } from '../../lib/visits'
import { sectionLabel, input, ghostBtn } from '../visite/visiteStyles'
import { Empty } from '../visite/visiteBits'
import { MultiSelectChips } from '../cr/MultiSelectChips'
import { CrExport } from './CrExport'

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

const PRIORITY_LABEL: Record<ReservePriority, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute' }

const FOLLOW_LABEL: Record<FollowUpStatus, string> = {
  done: 'Terminé', in_progress: 'En cours', not_done: 'Non fait',
  rescheduled: 'Reporté', obsolete: 'Rendu obsolète', comment: 'Commentaire',
}

export type View = 'par-lot' | 'par-logement' | 'par-reunion'
type DisplayFilter = 'tous' | 'importants'

type ColumnVisibility = {
  crNo: boolean
  description: boolean
  lotCompany: boolean
  logements: boolean
  kind: boolean
  dueDate: boolean
  status: boolean
}

interface Group { key: string; label: string; rows: Reserve[] }

/** Regroupement par lot / logement / réunion (sections 9-10) : une remarque
 * multi-lots ou multi-logements apparaît dans CHAQUE groupe concerné — jamais
 * dupliquée en base, seulement à l'affichage (fan-out sur les clés). */
export function buildGroups(rows: Reserve[], view: View, lots: { id: string; name: string }[], zoneRefs: ZoneRef[]): Group[] {
  const groups = new Map<string, Reserve[]>()
  const push = (key: string, r: Reserve) => {
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  if (view === 'par-lot') {
    for (const r of rows) {
      const ids = getReserveLots(r)
      if (ids.length === 0) push('__none__', r)
      else for (const id of ids) push(id, r)
    }
    const ordered: Group[] = lots.filter(l => groups.has(l.id)).map(l => ({ key: l.id, label: l.name, rows: groups.get(l.id)! }))
    if (groups.has('__none__')) ordered.push({ key: '__none__', label: 'Sans lot', rows: groups.get('__none__')! })
    return ordered
  }
  if (view === 'par-logement') {
    for (const r of rows) {
      const ids = getReserveLocations(r)
      if (ids.length === 0) push('__none__', r)
      else for (const id of ids) push(id, r)
    }
    const ordered: Group[] = zoneRefs.filter(z => groups.has(z.refId))
      .map(z => ({ key: z.refId, label: `${z.buildingLabel} — ${z.label}`, rows: groups.get(z.refId)! }))
    if (groups.has('__none__')) ordered.push({ key: '__none__', label: 'Partie commune / non localisé', rows: groups.get('__none__')! })
    return ordered
  }
  // par-reunion : une remarque n'a qu'un seul crNo — pas de fan-out nécessaire.
  for (const r of rows) push(r.crNo != null ? String(r.crNo) : '__none__', r)
  const nums = [...groups.keys()].filter(k => k !== '__none__').map(Number).sort((a, b) => b - a)
  const ordered: Group[] = nums.map(n => ({ key: String(n), label: `CR ${n}`, rows: groups.get(String(n))! }))
  if (groups.has('__none__')) ordered.push({ key: '__none__', label: 'Sans réunion', rows: groups.get('__none__')! })
  return ordered
}

export function CrTable() {
  const [reserves, setReserves] = useState<Reserve[]>(getReserves)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [view, setView] = useState<View>('par-reunion')
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>('tous')
  const [locked, setLocked] = useState(true)
  const [selectedCr, setSelectedCr] = useState<number | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showVisibility, setShowVisibility] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [sortBy, setSortBy] = useState<'status' | 'crNo' | 'date' | 'lot'>('status')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [lotFilter, setLotFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [logementFilter, setLogementFilter] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<ReservePriority | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sc_cr_search_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [columnVis, setColumnVis] = useState<ColumnVisibility>(() => {
    try {
      const saved = localStorage.getItem('sc_cr_columns')
      return saved ? JSON.parse(saved) : { crNo: true, description: true, lotCompany: true, logements: true, kind: true, dueDate: true, status: true }
    } catch {
      return { crNo: true, description: true, lotCompany: true, logements: true, kind: true, dueDate: true, status: true }
    }
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const lots = useMemo(() => getLotsConfig(), [])
  const zoneRefs = useMemo(() => getZoneRefs(), [])
  const companies = useMemo(
    () => [...new Set(reserves.flatMap(getReserveCompanies))].sort(),
    [reserves],
  )
  const today = todayISO()

  // ── URL state sync: read from URL on mount ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const savedView = params.get('view') as View | null
    if (savedView === 'par-lot' || savedView === 'par-logement' || savedView === 'par-reunion') setView(savedView)
    const searchParam = params.get('search')
    if (searchParam) setSearchTerm(decodeURIComponent(searchParam))
    const crParam = params.get('crNo')
    if (crParam) {
      const num = Number(crParam)
      if (!isNaN(num)) setSelectedCr(num)
    }
  }, [])

  // ── URL state sync: update URL when state changes ───────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (view !== 'par-reunion') params.set('view', view)
    else params.delete('view')
    if (searchTerm) params.set('search', encodeURIComponent(searchTerm))
    else params.delete('search')
    if (selectedCr !== null) params.set('crNo', String(selectedCr))
    else params.delete('crNo')
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }, [view, searchTerm, selectedCr])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey
      if (isMod && e.key === 'n') {
        e.preventDefault()
        setAdding(a => !a)
      } else if ((isMod && e.key === '/') || e.key === '?') {
        e.preventDefault()
        setShowKeyboardHelp(h => !h)
      } else if (e.key === 'Escape') {
        if (adding) setAdding(false)
        if (searchTerm) setSearchTerm('')
        if (showKeyboardHelp) setShowKeyboardHelp(false)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [adding, searchTerm, showKeyboardHelp])

  const toggleColumnVis = (col: keyof ColumnVisibility) => {
    const next = { ...columnVis, [col]: !columnVis[col] }
    setColumnVis(next)
    try { localStorage.setItem('sc_cr_columns', JSON.stringify(next)) } catch { /* noop */ }
  }

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

  // Current "active" CR number — used when closing a reserve without a meeting,
  // pour l'archivage automatique (section 11) et le bleu+gras "nouveau/modifié" (12).
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

  // Filtered to selected CR (null = all), search term, status filters, and archive
  const filteredRows = useMemo(() => {
    let result = selectedCr !== null ? rows.filter(r => r.crNo === selectedCr) : rows

    if (!showArchived) {
      result = result.filter(r => !isArchivedAt(r, currentCrNo))
    }

    if (displayFilter === 'importants') {
      result = result.filter(r => r.reminder)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(r =>
        r.description.toLowerCase().includes(term) ||
        getReserveLots(r).some(id => id.toLowerCase().includes(term)) ||
        getReserveCompanies(r).some(c => c.toLowerCase().includes(term)) ||
        r.number.toLowerCase().includes(term)
      )
    }

    if (statusFilter.size > 0) {
      result = result.filter(r => {
        const { tone } = crState(r, today, latestMeetingDate)
        return statusFilter.has(tone)
      })
    }

    if (lotFilter) result = result.filter(r => getReserveLots(r).includes(lotFilter))
    if (companyFilter) result = result.filter(r => getReserveCompanies(r).includes(companyFilter) || r.allCompanies)
    if (logementFilter) result = result.filter(r => getReserveLocations(r).includes(logementFilter))
    if (priorityFilter) result = result.filter(r => r.priority === priorityFilter)

    // Apply sorting based on sortBy
    if (sortBy === 'crNo') {
      result.sort((a, b) => (b.crNo ?? -1) - (a.crNo ?? -1))
    } else if (sortBy === 'date') {
      result.sort((a, b) => (b.meetingDate ?? '').localeCompare(a.meetingDate ?? ''))
    } else if (sortBy === 'lot') {
      result.sort((a, b) => (getReserveLots(a)[0] ?? '').localeCompare(getReserveLots(b)[0] ?? ''))
    }
    // 'status' is already the default sort in rows

    return result
  }, [rows, selectedCr, searchTerm, statusFilter, lotFilter, companyFilter, logementFilter, priorityFilter, sortBy, showArchived, displayFilter, currentCrNo, today, latestMeetingDate])

  const groups = useMemo(() => buildGroups(filteredRows, view, lots, zoneRefs), [filteredRows, view, lots, zoneRefs])

  const lotLabel = (id: string) => lots.find(l => l.id === id)?.name ?? id
  const zoneLabel = (id: string) => { const z = zoneRefs.find(z => z.refId === id); return z ? z.label : id }

  const toggle = (id: string) => setOpen(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const follow = (r: Reserve, status: FollowUpStatus, opts: { dueDate?: string; note?: string } = {}) => {
    const f = { at: new Date().toISOString(), visitId: 'cr-table', visitDate: today, status, ...opts }
    let updated = applyFollowUp(r, f)
    updated = { ...updated, lastModifiedCrNo: currentCrNo }
    if (updated.status === 'resolved' || updated.status === 'obsolete') {
      // Clôture (section 11) : reste visible au CR de clôture + les 2 suivants,
      // archivée automatiquement à partir de N+3 (isArchivedAt, reserves.ts).
      updated = { ...updated, closedCrNo: currentCrNo, crNo: updated.crNo ?? currentCrNo }
    } else if (updated.status === 'open') {
      updated = { ...updated, closedCrNo: undefined }
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
    persist(reserves.map(x => x.id === id ? { ...x, ...patch, lastModifiedCrNo: currentCrNo } : x))
    setEditing(null)
  }

  /** Édition « tableur » directe (section 6) : une cellule modifiée persiste et
   * s'historise immédiatement, sans passer par la fiche/modal. */
  const editCell = (id: string, patch: Partial<Reserve>) => {
    persist(reserves.map(x => x.id === id ? { ...x, ...patch, lastModifiedCrNo: currentCrNo } : x))
  }

  const addRow = (draft: Draft) => {
    const rv: Reserve = {
      id: `cr${Date.now()}${Math.floor(Math.random() * 1000)}`,
      number: nextReserveNumber(reserves),
      lotId: draft.lotIds[0] ?? '', lotIds: draft.lotIds,
      logementId: draft.logementIds[0] ?? '', logementIds: draft.logementIds,
      description: draft.description.trim(),
      priority: draft.reminder ? 'high' : 'medium', status: 'open',
      createdAt: new Date().toISOString(),
      company: draft.allCompanies ? undefined : draft.companyIds[0],
      companyIds: draft.allCompanies ? undefined : draft.companyIds,
      allCompanies: draft.allCompanies || undefined,
      kind: draft.kind, dueDate: draft.dueDate || undefined,
      crNo: draft.crNo ? Number(draft.crNo) : undefined,
      meetingDate: draft.meetingDate || undefined, reminder: draft.reminder || undefined,
      createdCrNo: draft.crNo ? Number(draft.crNo) : currentCrNo,
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

  const bulkMarkAsDone = () => {
    const updated = reserves.map(r =>
      selectedRows.has(r.id) ? { ...r, status: 'resolved' as const, closedCrNo: currentCrNo, lastModifiedCrNo: currentCrNo } : r
    )
    persist(updated)
    logActivity('doc', `${selectedRows.size} point(s) marqué(s) comme terminé(s)`)
    setSelectedRows(new Set())
  }

  const bulkDelete = () => {
    if (!window.confirm(`Supprimer ${selectedRows.size} point(s) ?`)) return
    const updated = reserves.filter(r => !selectedRows.has(r.id))
    persist(updated)
    logActivity('doc', `${selectedRows.size} point(s) supprimé(s)`)
    setSelectedRows(new Set())
  }

  const bulkToggleSelection = (rowIds: string[]) => {
    const allSelected = rowIds.every(id => selectedRows.has(id))
    const next = new Set(selectedRows)
    rowIds.forEach(id => {
      if (allSelected) next.delete(id)
      else next.add(id)
    })
    setSelectedRows(next)
  }

  const archiveReserve = (id: string) => {
    const updated = reserves.map(r => r.id === id ? { ...r, archived: true } : r)
    persist(updated)
    logActivity('doc', `Point archivé`)
  }

  const unarchiveReserve = (id: string) => {
    const updated = reserves.map(r => r.id === id ? { ...r, archived: false } : r)
    persist(updated)
    logActivity('doc', `Point restauré`)
  }

  const addSearchToHistory = (term: string) => {
    if (!term.trim()) return
    const next = [term, ...searchHistory.filter(s => s !== term)].slice(0, 10)
    setSearchHistory(next)
    try { localStorage.setItem('sc_cr_search_history', JSON.stringify(next)) } catch { /* noop */ }
  }

  const exportFilteredAsCsv = () => {
    if (filteredRows.length === 0) return
    const csvRows = filteredRows.map(r => {
      const { tone } = crState(r, today, latestMeetingDate)
      const ts = TONE_STYLE[tone]
      return {
        Numéro: r.number,
        'N°CR': r.crNo ?? '—',
        Lot: getReserveLots(r).map(lotLabel).join(' / ') || '—',
        Entreprise: r.allCompanies ? 'Toutes' : getReserveCompanies(r).join(' / ') || '—',
        Remarque: r.description,
        Type: reserveKind(r) === 'action' ? 'Action' : 'Observation',
        Statut: ts.label || '—',
        Échéance: frDate(r.dueDate),
        'Date réunion': frDate(r.meetingDate),
        Rappel: r.reminder ? 'Oui' : 'Non',
      }
    })
    const headers = ['Numéro', 'N°CR', 'Lot', 'Entreprise', 'Remarque', 'Type', 'Statut', 'Échéance', 'Date réunion', 'Rappel']
    const csvContent = [
      headers.join('\t'),
      ...csvRows.map(r => headers.map(h => r[h as keyof typeof r] ?? '').join('\t'))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `cr-export-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    logActivity('doc', `Export CR : ${filteredRows.length} point(s) exporté(s)`)
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Toolbar principale (section 5) : Ajouter / Importer Excel / Exporter PDF / (Dé)verrouiller */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setAdding(a => !a)} style={{ ...ghostBtn, borderColor: 'var(--navy)', color: 'var(--navy)' }}>
          <Plus size={14} /> Ajouter
        </button>
        <button onClick={() => fileRef.current?.click()} style={ghostBtn}>
          <Upload size={14} /> Importer Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
        <button onClick={() => setShowExport(true)} style={{ ...ghostBtn, color: 'var(--navy)' }}>
          <FileOutput size={14} /> Exporter PDF
        </button>
        <button
          onClick={() => setLocked(l => !l)}
          title={locked ? 'Déverrouiller pour éditer directement le tableau' : 'Verrouiller le tableau'}
          style={{ ...ghostBtn, background: locked ? '#fff' : '#eef4fb', borderColor: locked ? 'var(--line)' : 'var(--navy)', color: 'var(--navy)' }}
        >
          {locked ? <><Lock size={14} /> Déverrouiller</> : <><Unlock size={14} /> Verrouiller</>}
        </button>
        <div style={{ flex: 1 }} />
        {selectedRows.size > 0 && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingLeft: '8px', borderLeft: '1px solid var(--line)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--navy)' }}>{selectedRows.size} sélectionné(s)</span>
            <button onClick={bulkMarkAsDone} title="Marquer comme terminé" style={{ ...ghostBtn, padding: '4px 8px', fontSize: '11px', color: 'var(--ok)' }}>
              <Check size={14} /> Terminer
            </button>
            <button onClick={bulkDelete} title="Supprimer les sélections" style={{ ...ghostBtn, padding: '4px 8px', fontSize: '11px', color: '#dc2626' }}>
              <Ban size={14} /> Supprimer
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '4px' }}>
          {filteredRows.length > 0 && (
            <button onClick={exportFilteredAsCsv} title="Exporter en CSV" style={{ ...ghostBtn, padding: '6px 10px', fontSize: '11px' }}>
              <Download size={13} /> CSV
            </button>
          )}
          <button onClick={() => window.print()} title="Imprimer" style={{ ...ghostBtn, padding: '6px 10px', fontSize: '11px' }}>
            <Printer size={13} />
          </button>
          <button onClick={() => setShowArchived(v => !v)} title={showArchived ? 'Masquer les archivés' : 'Afficher les archivés'} style={{ ...ghostBtn, padding: '6px 10px', fontSize: '11px', background: showArchived ? '#fff' : 'transparent', color: showArchived ? 'var(--navy)' : 'var(--muted)' }}>
            {showArchived ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowVisibility(v => !v)} title="Colonnes à afficher" style={{ ...ghostBtn, padding: '6px 10px', fontSize: '11px', background: showVisibility ? '#fff' : 'transparent' }}>
              <Eye size={13} />
            </button>
            {showVisibility && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', minWidth: '180px', boxShadow: '0 4px 12px rgba(0,0,0,.12)', zIndex: 50 }}>
                {[
                  { key: 'crNo', label: 'N° CR' },
                  { key: 'description', label: 'Remarque' },
                  { key: 'lotCompany', label: 'Lot / Entreprise' },
                  { key: 'logements', label: 'Logements Concernés' },
                  { key: 'kind', label: 'Type' },
                  { key: 'dueDate', label: 'Échéance' },
                  { key: 'status', label: 'Statut' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '6px 0', cursor: 'pointer', color: 'var(--navy)' }}>
                    <input
                      type="checkbox"
                      checked={columnVis[key as keyof ColumnVisibility]}
                      onChange={() => toggleColumnVis(key as keyof ColumnVisibility)}
                      style={{ accentColor: '#02457A' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CR navigation chips */}
      {crNumbers.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button
            onClick={() => setSelectedCr(null)}
            style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--line)', background: selectedCr === null ? '#02457A' : '#fff', color: selectedCr === null ? '#fff' : 'var(--navy)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            Tous les CR
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
        <span><b style={{ color: '#018ABE' }}>Bleu gras</b> : évoqué à la dernière réunion, ou nouveau/modifié au CR {currentCrNo}</span>
        <span><b style={{ color: '#b45309' }}>Orange</b> : reporté</span>
      </div>

      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '9px', background: '#eef4fb', border: '1px solid #d3e3f2', color: '#274b6b', fontSize: '12px', marginBottom: '12px' }}>
          {notice}<button onClick={() => setNotice(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#274b6b', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {showKeyboardHelp && (
        <div style={{ padding: '12px', borderRadius: '10px', background: '#f0f9ff', border: '1px solid #bfdbfe', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)' }}>Raccourcis clavier</div>
            <button onClick={() => setShowKeyboardHelp(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '11px', color: 'var(--ink)' }}>
            <div><kbd style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 600 }}>Ctrl+N</kbd> Nouveau point</div>
            <div><kbd style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 600 }}>Ctrl+/</kbd> Aide clavier</div>
            <div><kbd style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 600 }}>Esc</kbd> Fermer/Annuler</div>
          </div>
        </div>
      )}

      {adding && <AddForm lots={lots} zoneRefs={zoneRefs} companies={companies} onCancel={() => setAdding(false)} onAdd={addRow} />}

      {/* Search bar with history */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Rechercher une remarque…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onFocus={() => setShowSearchHistory(true)}
            onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchTerm.trim()) {
                addSearchToHistory(searchTerm)
              }
            }}
            style={{ ...input, flex: 1, fontSize: '13px', padding: '8px 10px' }}
          />
          {searchTerm ? (
            <button onClick={() => { setSearchTerm(''); setShowSearchHistory(false) }} style={{ ...ghostBtn, padding: '6px 8px' }}>
              <X size={14} />
            </button>
          ) : (
            searchHistory.length > 0 && (
              <button onClick={() => setShowSearchHistory(h => !h)} title="Historique de recherche" style={{ ...ghostBtn, padding: '6px 8px', color: 'var(--muted)' }}>
                <Clock size={14} />
              </button>
            )
          )}
        </div>
        {showSearchHistory && searchHistory.length > 0 && !searchTerm && (
          <div style={{ position: 'absolute', top: '100%', left: '30px', right: '8px', marginTop: '4px', background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,.12)', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', padding: '8px 10px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Récents</div>
            {searchHistory.map(term => (
              <button
                key={term}
                onClick={() => { setSearchTerm(term); setShowSearchHistory(false) }}
                style={{ display: 'flex', width: '100%', padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink)', fontSize: '12px', alignItems: 'center', gap: '6px', textAlign: 'left' }}
              >
                <Clock size={12} color="var(--muted)" />
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AFFICHAGE (section 5) : Tous / Importants — jamais de filtre de statut caché par défaut */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Affichage</span>
        <div style={{ display: 'flex', gap: '2px', background: '#eef2f6', padding: '2px', borderRadius: '7px' }}>
          {([['tous', 'Tous'], ['importants', 'Importants']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setDisplayFilter(v)}
              style={{ padding: '6px 12px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: displayFilter === v ? '#fff' : 'transparent', color: displayFilter === v ? '#02457A' : '#5b7183' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* REGROUPEMENT (section 5) : Par lot / Par logement / Par réunion — défaut Par lot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Regroupement</span>
        <div style={{ display: 'flex', gap: '2px', background: '#eef2f6', padding: '2px', borderRadius: '7px' }}>
          <button onClick={() => setView('par-lot')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: view === 'par-lot' ? '#fff' : 'transparent', color: view === 'par-lot' ? '#02457A' : '#5b7183' }}>
            <Layers size={13} /> Par lot
          </button>
          <button onClick={() => setView('par-logement')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: view === 'par-logement' ? '#fff' : 'transparent', color: view === 'par-logement' ? '#02457A' : '#5b7183' }}>
            <Building2 size={13} /> Par logement
          </button>
          <button onClick={() => setView('par-reunion')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: view === 'par-reunion' ? '#fff' : 'transparent', color: view === 'par-reunion' ? '#02457A' : '#5b7183' }}>
            <CalendarClock size={13} /> Par réunion
          </button>
        </div>
      </div>

      {/* Filtres avancés (conservés, repliables par défaut hors du flux principal) */}
      <details style={{ marginBottom: '12px' }}>
        <summary style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>Filtres avancés (statut, lot, entreprise, logement, priorité, tri)</summary>
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '2px', background: '#eef2f6', padding: '2px', borderRadius: '7px', marginBottom: '8px', width: 'fit-content' }}>
            {[
              { value: 'status' as const, label: 'Par statut' },
              { value: 'crNo' as const, label: 'Par N°CR' },
              { value: 'date' as const, label: 'Par date' },
              { value: 'lot' as const, label: 'Tri lot' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                title={opt.label}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: sortBy === opt.value ? '#fff' : 'transparent', color: sortBy === opt.value ? '#02457A' : '#5b7183' }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {[
              { tone: 'overdue', label: 'En retard' },
              { tone: 'reminder', label: 'Rappel' },
              { tone: 'reported', label: 'Reporté' },
              { tone: 'done', label: 'Terminé' },
              { tone: 'obsolete', label: 'Obsolète' },
            ].map(({ tone, label }) => {
              const ts = TONE_STYLE[tone]
              const isActive = statusFilter.has(tone)
              return (
                <button
                  key={tone}
                  onClick={() => {
                    const next = new Set(statusFilter)
                    if (isActive) next.delete(tone)
                    else next.add(tone)
                    setStatusFilter(next)
                  }}
                  title={label}
                  style={{ fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '999px', border: `1px solid ${ts.color}`, background: isActive ? ts.bg : '#fff', color: ts.color, cursor: 'pointer' }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select value={lotFilter ?? ''} onChange={e => setLotFilter(e.target.value || null)} style={{ ...input, width: 'auto', fontSize: '11px', padding: '5px 8px' }}>
              <option value="">Tous lots</option>
              {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={companyFilter ?? ''} onChange={e => setCompanyFilter(e.target.value || null)} style={{ ...input, width: 'auto', fontSize: '11px', padding: '5px 8px' }}>
              <option value="">Toutes entreprises</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={logementFilter ?? ''} onChange={e => setLogementFilter(e.target.value || null)} style={{ ...input, width: 'auto', fontSize: '11px', padding: '5px 8px' }}>
              <option value="">Tous bâtiments / logements</option>
              {zoneRefs.map(z => <option key={z.refId} value={z.refId}>{z.buildingLabel} — {z.label}</option>)}
            </select>
            {(Object.keys(PRIORITY_LABEL) as ReservePriority[]).map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(f => f === p ? null : p)}
                title={`Priorité ${PRIORITY_LABEL[p]}`}
                style={{
                  fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '999px',
                  border: '1px solid var(--navy)', background: priorityFilter === p ? 'var(--sky-soft)' : '#fff',
                  color: 'var(--navy)', cursor: 'pointer',
                }}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
            {(lotFilter || companyFilter || logementFilter || priorityFilter) && (
              <button
                onClick={() => { setLotFilter(null); setCompanyFilter(null); setLogementFilter(null); setPriorityFilter(null) }}
                style={{ fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '999px', border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </details>

      {/* Quick stats */}
      {filteredRows.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '11px', color: 'var(--muted)' }}>
          <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{filteredRows.length}</span> au total
          </div>
          <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{filteredRows.filter(r => r.status === 'open').length}</span> ouvert(s)
          </div>
          <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{filteredRows.filter(r => r.status === 'resolved' || r.status === 'obsolete').length}</span> fermé(s)
          </div>
          <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 600, color: '#dc2626' }}>{filteredRows.filter(r => crState(r, today, latestMeetingDate).tone === 'overdue').length}</span> en retard
          </div>
        </div>
      )}

      <div style={sectionLabel}>Journal ({filteredRows.length})</div>
      {filteredRows.length === 0 && <Empty>Aucun point. Ajoutez-en un ou importez un CR Excel.</Empty>}

      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#02457A', padding: '8px 10px', background: '#f0f4f8', borderRadius: '8px 8px 0 0', border: '1px solid var(--line)', borderBottom: 'none' }}>
            {g.label} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '11px' }}>({g.rows.length})</span>
          </div>
          <div className="cr-list-table" style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '0 0 10px 10px' }}>
            <div style={{ minWidth: '640px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: buildGridCols(columnVis), gap: '8px', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid var(--line)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={g.rows.length > 0 && g.rows.every(r => selectedRows.has(r.id))}
                  onChange={() => bulkToggleSelection(g.rows.map(r => r.id))}
                  style={{ accentColor: '#02457A', cursor: 'pointer' }}
                />
                {columnVis.crNo && <span>CR</span>}
                {columnVis.description && <span>Point</span>}
                {columnVis.lotCompany && <span>Lot / Entreprise</span>}
                {columnVis.logements && <span>Logements Concernés</span>}
                {columnVis.kind && <span>Type</span>}
                {columnVis.dueDate && <span>Échéance</span>}
                {columnVis.status && <span>Statut</span>}
              </div>
              {g.rows.map(r => (
                <RowLine
                  key={`${g.key}-${r.id}`}
                  r={r}
                  columnVis={columnVis}
                  locked={locked}
                  lots={lots}
                  zoneRefs={zoneRefs}
                  companies={companies}
                  currentCrNo={currentCrNo}
                  today={today}
                  latestMeetingDate={latestMeetingDate}
                  expanded={open.has(r.id)}
                  isEditing={editing === r.id}
                  isSelected={selectedRows.has(r.id)}
                  lotLabel={lotLabel}
                  zoneLabel={zoneLabel}
                  onToggleExpand={() => toggle(r.id)}
                  onToggleSelect={() => {
                    const next = new Set(selectedRows)
                    if (next.has(r.id)) next.delete(r.id); else next.add(r.id)
                    setSelectedRows(next)
                  }}
                  onEdit={() => setEditing(r.id)}
                  onCancelEdit={() => setEditing(null)}
                  onSave={patch => updateReserve(r.id, patch)}
                  onCell={patch => editCell(r.id, patch)}
                  onFollow={(status, opts) => follow(r, status, opts)}
                  onReport={weeks => report(r, weeks)}
                  onComment={() => comment(r)}
                  onArchive={() => archiveReserve(r.id)}
                  onUnarchive={() => unarchiveReserve(r.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      {showExport && <CrExport reserves={reserves} lots={lots} crNumbers={crNumbers} onClose={() => setShowExport(false)} />}
    </div>
  )
}

const buildGridCols = (vis: ColumnVisibility): string => {
  const cols: string[] = ['30px'] // checkbox column
  if (vis.crNo) cols.push('52px')
  if (vis.description) cols.push('1fr')
  if (vis.lotCompany) cols.push('150px')
  if (vis.logements) cols.push('150px')
  if (vis.kind) cols.push('60px')
  if (vis.dueDate) cols.push('90px')
  if (vis.status) cols.push('84px')
  return cols.join(' ')
}

// ── Une ligne du journal — lecture, expansion, et édition « tableur » quand déverrouillé ──

interface RowLineProps {
  r: Reserve
  columnVis: ColumnVisibility
  locked: boolean
  lots: { id: string; name: string }[]
  zoneRefs: ZoneRef[]
  companies: string[]
  currentCrNo: number
  today: string
  latestMeetingDate?: string
  expanded: boolean
  isEditing: boolean
  isSelected: boolean
  lotLabel: (id: string) => string
  zoneLabel: (id: string) => string
  onToggleExpand: () => void
  onToggleSelect: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (patch: Partial<Reserve>) => void
  onCell: (patch: Partial<Reserve>) => void
  onFollow: (status: FollowUpStatus, opts?: { dueDate?: string; note?: string }) => void
  onReport: (weeks: number) => void
  onComment: () => void
  onArchive: () => void
  onUnarchive: () => void
}

function RowLine({
  r, columnVis, locked, lots, zoneRefs, companies, currentCrNo, today, latestMeetingDate,
  expanded, isEditing, isSelected, lotLabel, zoneLabel,
  onToggleExpand, onToggleSelect, onEdit, onCancelEdit, onSave, onCell, onFollow, onReport, onComment, onArchive, onUnarchive,
}: RowLineProps) {
  const { tone, lastMeeting } = crState(r, today, latestMeetingDate)
  const ts = TONE_STYLE[tone]
  const isNewOrMod = isNewOrModifiedAt(r, currentCrNo)
  const emphasize = (lastMeeting || isNewOrMod) && tone === 'normal'
  const lotChips = getReserveLots(r).map(lotLabel)
  const locationChips = getReserveLocations(r).map(zoneLabel)
  const companyText = r.allCompanies ? 'Toutes les entreprises' : getReserveCompanies(r).join(', ')

  return (
    <div style={{ borderBottom: '1px solid #eef2f6', background: ts.bg }}>
      <div style={{ display: 'grid', gridTemplateColumns: buildGridCols(columnVis), gap: '8px', padding: '9px 12px', alignItems: 'start', fontSize: '12px' }} className="cr-row">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          style={{ accentColor: '#02457A', cursor: 'pointer', marginTop: 2 }}
        />
        {!locked ? (
          <>
            {columnVis.crNo && (
              <input value={r.crNo ?? ''} onChange={e => onCell({ crNo: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })} style={{ ...input, padding: '4px 6px', fontSize: 11, width: '100%' }} />
            )}
            {columnVis.description && (
              <textarea value={r.description} onChange={e => onCell({ description: e.target.value })} rows={1} style={{ ...input, padding: '4px 6px', fontSize: 12, width: '100%', resize: 'vertical' }} />
            )}
            {columnVis.lotCompany && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <MultiSelectChips options={lots.map(l => ({ id: l.id, label: l.name }))} selected={getReserveLots(r)} onChange={ids => onCell({ lotIds: ids, lotId: ids[0] ?? '' })} placeholder="Lot(s)" />
                <MultiSelectChips options={companies.map(c => ({ id: c, label: c }))} selected={r.allCompanies ? [] : getReserveCompanies(r)} onChange={ids => onCell({ companyIds: ids, company: ids[0] })} placeholder="Entreprise(s)" disabled={r.allCompanies} />
              </div>
            )}
            {columnVis.logements && (
              <MultiSelectChips options={zoneRefs.map(z => ({ id: z.refId, label: `${z.buildingLabel} — ${z.label}` }))} selected={getReserveLocations(r)} onChange={ids => onCell({ logementIds: ids, logementId: ids[0] ?? '' })} placeholder="Logement(s)" />
            )}
            {columnVis.kind && (
              <select value={reserveKind(r)} onChange={e => onCell({ kind: e.target.value as ReserveKind })} style={{ ...input, padding: '4px 6px', fontSize: 11 }}>
                <option value="action">Action</option>
                <option value="observation">Info</option>
              </select>
            )}
            {columnVis.dueDate && (
              <input type="date" value={r.dueDate ?? ''} onChange={e => onCell({ dueDate: e.target.value || undefined })} style={{ ...input, padding: '4px 6px', fontSize: 11 }} />
            )}
            {columnVis.status && <span>{ts.label && <span style={{ fontSize: '10px', fontWeight: 700, color: ts.color, background: '#fff', border: `1px solid ${ts.color}33`, borderRadius: '999px', padding: '2px 8px' }}>{ts.label}</span>}</span>}
          </>
        ) : (
          <div onClick={() => { if (!isEditing) onToggleExpand() }} style={{ display: 'contents', cursor: 'pointer' }}>
            {columnVis.crNo && (
              <span style={{ fontWeight: 600, color: emphasize ? '#018ABE' : 'var(--navy)' }}>
                {r.crNo != null ? `#${r.crNo}` : '—'}
              </span>
            )}
            {columnVis.description && (
              <div>
                <span style={{ color: emphasize ? '#018ABE' : (tone === 'normal' ? 'var(--ink, #1f2937)' : ts.color), fontWeight: emphasize || tone === 'reminder' ? 700 : 400 }}>
                  {r.reminder && <Flag size={11} color="#dc2626" style={{ verticalAlign: '-1px', marginRight: '4px' }} />}
                  {r.description}
                </span>
                {locationChips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                    {locationChips.map(l => (
                      <span key={l} style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', background: '#eef2f6', borderRadius: 4, padding: '1px 5px' }}>{l}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {columnVis.lotCompany && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {lotChips.length > 0 && <span style={{ color: 'var(--muted)', fontSize: 11 }}>{lotChips.join(', ')}</span>}
                {companyText && <span style={{ color: 'var(--muted)', fontSize: 11 }}>{companyText}</span>}
              </div>
            )}
            {columnVis.logements && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {locationChips.length > 0 ? locationChips.map(l => <span key={l} style={{ color: 'var(--muted)', fontSize: 11 }}>{l}</span>) : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
              </div>
            )}
            {columnVis.kind && <span style={{ color: 'var(--muted)' }}>{reserveKind(r) === 'action' ? 'Action' : 'Info'}</span>}
            {columnVis.dueDate && <span style={{ color: tone === 'overdue' ? '#dc2626' : 'var(--muted)', fontWeight: tone === 'overdue' ? 700 : 400 }}>{frDate(r.dueDate)}</span>}
            {columnVis.status && <span>{ts.label && <span style={{ fontSize: '10px', fontWeight: 700, color: ts.color, background: '#fff', border: `1px solid ${ts.color}33`, borderRadius: '999px', padding: '2px 8px' }}>{ts.label}</span>}</span>}
          </div>
        )}
      </div>

      {expanded && (
        isEditing ? (
          <div style={{ padding: '8px 12px 14px 30px', background: '#f8fafc' }}>
            <EditForm reserve={r} lots={lots} zoneRefs={zoneRefs} companies={companies} onSave={onSave} onCancel={onCancelEdit} />
          </div>
        ) : (
          <div style={{ padding: '4px 12px 14px 30px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', flex: 1 }}>
                {r.number}{r.meetingDate ? ` · réunion du ${frDate(r.meetingDate)}` : ''}{r.reminder ? ' · rappel' : ''}{r.closedCrNo != null ? ` · clos au CR ${r.closedCrNo}` : ''}
              </div>
              {locked && (
                <button onClick={onEdit} title="Modifier ce point" style={{ ...ghostBtn, padding: '4px 8px', fontSize: '11px' }}>
                  <Pencil size={12} /> Modifier
                </button>
              )}
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
                <button onClick={() => onFollow('done')} style={{ ...ghostBtn, borderColor: '#a7f3d0', color: '#047857' }}><Check size={13} /> Terminé</button>
                <button onClick={() => onReport(1)} style={{ ...ghostBtn, borderColor: '#fed7aa', color: '#b45309' }}><Clock size={13} /> +1 sem</button>
                <button onClick={() => onReport(2)} style={{ ...ghostBtn, borderColor: '#fed7aa', color: '#b45309' }}><Clock size={13} /> +2 sem</button>
                <button onClick={() => onReport(4)} style={{ ...ghostBtn, borderColor: '#fed7aa', color: '#b45309' }}><Clock size={13} /> +4 sem</button>
                <button onClick={onComment} style={ghostBtn}><MessageSquarePlus size={13} /> Commenter</button>
                <button onClick={() => onFollow('obsolete')} style={{ ...ghostBtn, borderColor: '#e2e8f0', color: '#64748b' }}><Ban size={13} /> Obsolète</button>
              </div>
            )}
            {r.status !== 'open' && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => onFollow('in_progress', { note: 'Réouvert' })} style={ghostBtn}>Rouvrir</button>
                <button onClick={onArchive} style={{ ...ghostBtn, borderColor: '#d1d5db', color: '#6b7280' }}>Archiver</button>
              </div>
            )}
            {r.archived && (
              <button onClick={onUnarchive} style={ghostBtn}>Restaurer</button>
            )}
          </div>
        )
      )}
    </div>
  )
}

interface Draft {
  crNo: string; meetingDate: string; description: string
  lotIds: string[]; logementIds: string[]; companyIds: string[]; allCompanies: boolean
  kind: ReserveKind; dueDate: string; reminder: boolean
}

function AddForm({ lots, zoneRefs, companies, onAdd, onCancel }: {
  lots: { id: string; name: string }[]; zoneRefs: ZoneRef[]; companies: string[]
  onAdd: (d: Draft) => void; onCancel: () => void
}) {
  const [d, setD] = useState<Draft>({
    crNo: '', meetingDate: todayISO(), description: '',
    lotIds: [], logementIds: [], companyIds: [], allCompanies: false,
    kind: 'action', dueDate: '', reminder: false,
  })
  const set = (patch: Partial<Draft>) => setD(prev => ({ ...prev, ...patch }))
  return (
    <div style={{ padding: '13px', borderRadius: '11px', border: '1px solid var(--line)', background: '#f8fafc', marginBottom: '14px' }}>
      <div style={sectionLabel}>Nouveau point de CR</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input value={d.crNo} onChange={e => set({ crNo: e.target.value.replace(/\D/g, '') })} placeholder="N° CR" style={input} />
        <input type="date" value={d.meetingDate} onChange={e => set({ meetingDate: e.target.value })} style={input} />
      </div>
      <textarea value={d.description} onChange={e => set({ description: e.target.value })} placeholder="Remarque / note" rows={2} style={{ ...input, width: '100%', resize: 'vertical', marginBottom: '8px' }} />

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Lot(s)</div>
      <div style={{ marginBottom: 8 }}>
        <MultiSelectChips options={lots.map(l => ({ id: l.id, label: l.name }))} selected={d.lotIds} onChange={ids => set({ lotIds: ids })} placeholder="Un ou plusieurs lots…" />
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Logement(s) / localisation</div>
      <div style={{ marginBottom: 8 }}>
        <MultiSelectChips options={zoneRefs.map(z => ({ id: z.refId, label: `${z.buildingLabel} — ${z.label}` }))} selected={d.logementIds} onChange={ids => set({ logementIds: ids })} placeholder="Aucun = partie commune…" />
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Entreprise(s)</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <MultiSelectChips options={companies.map(c => ({ id: c, label: c }))} selected={d.companyIds} onChange={ids => set({ companyIds: ids })} placeholder="Une ou plusieurs entreprises…" disabled={d.allCompanies} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--navy)', whiteSpace: 'nowrap', paddingTop: 7 }}>
          <input type="checkbox" checked={d.allCompanies} onChange={e => set({ allCompanies: e.target.checked })} />
          Toutes
        </label>
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

// ── Inline edit form (locked mode — modal-like, unlocked mode uses RowLine cells directly) ──

function EditForm({ reserve, lots, zoneRefs, companies, onSave, onCancel }: {
  reserve: Reserve
  lots: { id: string; name: string }[]
  zoneRefs: ZoneRef[]
  companies: string[]
  onSave: (patch: Partial<Reserve>) => void
  onCancel: () => void
}) {
  const [desc, setDesc] = useState(reserve.description)
  const [companyIds, setCompanyIds] = useState<string[]>(getReserveCompanies(reserve))
  const [allCompanies, setAllCompanies] = useState(!!reserve.allCompanies)
  const [lotIds, setLotIds] = useState<string[]>(getReserveLots(reserve))
  const [logementIds, setLogementIds] = useState<string[]>(getReserveLocations(reserve))
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
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>Lot(s)</div>
        <MultiSelectChips options={lots.map(l => ({ id: l.id, label: l.name }))} selected={lotIds} onChange={setLotIds} placeholder="Lot(s)" />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>Logement(s)</div>
        <MultiSelectChips options={zoneRefs.map(z => ({ id: z.refId, label: `${z.buildingLabel} — ${z.label}` }))} selected={logementIds} onChange={setLogementIds} placeholder="Logement(s)" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>Entreprise(s)</div>
          <MultiSelectChips options={companies.map(c => ({ id: c, label: c }))} selected={companyIds} onChange={setCompanyIds} placeholder="Entreprise(s)" disabled={allCompanies} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--navy)', whiteSpace: 'nowrap', paddingTop: 18 }}>
          <input type="checkbox" checked={allCompanies} onChange={e => setAllCompanies(e.target.checked)} />
          Toutes
        </label>
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
            description: desc.trim(),
            lotIds, lotId: lotIds[0] ?? '',
            logementIds, logementId: logementIds[0] ?? '',
            companyIds: allCompanies ? undefined : companyIds, company: allCompanies ? undefined : companyIds[0], allCompanies: allCompanies || undefined,
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
  const lotId = pick(row, ['lot', 'codelot'])
  const crNo = crNoRaw ? Number(crNoRaw.replace(/\D/g, '')) || undefined : undefined
  return {
    id: `cr${Date.now()}${i}${Math.floor(Math.random() * 1000)}`,
    number: `R-${String(offset + i + 1).padStart(3, '0')}`,
    lotId, lotIds: lotId ? [lotId] : undefined,
    logementId: '',
    description,
    priority: reminder ? 'high' : 'medium',
    status: /(fait|termine|solde|done|resolu)/.test(statusRaw) ? 'resolved' : 'open',
    createdAt: new Date().toISOString(),
    company: pick(row, ['entreprise', 'societe', 'responsable', 'intervenant']) || undefined,
    kind,
    dueDate: pick(row, ['echeance', 'datelimite', 'delai', 'due', 'pourle']) || undefined,
    crNo,
    meetingDate: pick(row, ['datereunion', 'datedereunion', 'date', 'datevisite', 'datecr']) || undefined,
    reminder: reminder || undefined,
    createdCrNo: crNo,
  }
}
