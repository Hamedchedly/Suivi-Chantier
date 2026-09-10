import { useState, useEffect, useRef } from 'react'
import { Plus, Camera, Check, X, MapPin } from 'lucide-react'
import { LOGEMENTS } from '../../data/zones'
import {
  Reserve, ReservePriority, nextReserveNumber, filterReserves, countOpen,
} from '../../lib/reserves'
import { getReserves, saveReserves, logActivity } from '../../lib/repo'

const LOTS = [
  { id: 'L05', name: 'LOT 05 - Menuiseries' },
  { id: 'L06', name: 'LOT 06 - Électricité' },
  { id: 'L07', name: 'LOT 07 - CVC' },
  { id: 'L08', name: 'LOT 08 - Embellissements' },
]

const lotName = (id: string) => LOTS.find(l => l.id === id)?.name ?? id
const logementLabel = (id: string) => LOGEMENTS.find(l => l.id === id)?.label ?? id

const PRIORITY_META: Record<ReservePriority, { label: string; bg: string; fg: string }> = {
  low: { label: 'Faible', bg: '#eef2f6', fg: '#5b7183' },
  medium: { label: 'Moyenne', bg: '#fef3c7', fg: '#b45309' },
  high: { label: 'Haute', bg: '#fdecec', fg: '#dc2626' },
}

// Downscale an image file to a small JPEG data URL (max 800px, quality 0.7).
function fileToThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 800
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no ctx'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function Reserves() {
  const [reserves, setReserves] = useState<Reserve[]>(getReserves)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all')
  const [filterLot, setFilterLot] = useState<string | null>(null)

  // draft
  const [dLot, setDLot] = useState('L05')
  const [dLogement, setDLogement] = useState('A-101')
  const [dDesc, setDDesc] = useState('')
  const [dPriority, setDPriority] = useState<ReservePriority>('medium')
  const [dPhoto, setDPhoto] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveReserves(reserves)
  }, [reserves])

  const visible = filterReserves(reserves, { status: filterStatus, lotId: filterLot })

  const addReserve = () => {
    if (!dDesc.trim()) return
    const nr: Reserve = {
      id: `r${Date.now()}`,
      number: nextReserveNumber(reserves),
      lotId: dLot,
      logementId: dLogement,
      description: dDesc.trim(),
      priority: dPriority,
      status: 'open',
      photo: dPhoto,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setReserves(prev => [nr, ...prev])
    logActivity('reserve', `Réserve ${nr.number} créée — ${nr.description}`)
    setDDesc(''); setDPhoto(undefined); setShowForm(false)
  }

  const toggleStatus = (id: string) => {
    setReserves(prev => prev.map(r => {
      if (r.id !== id) return r
      const status = r.status === 'open' ? 'resolved' as const : 'open' as const
      logActivity('resolve', `Réserve ${r.number} ${status === 'resolved' ? 'levée' : 'rouverte'}`)
      return { ...r, status }
    }))
  }

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try { setDPhoto(await fileToThumbnail(file)) } catch { /* ignore */ }
    }
  }

  const openCount = countOpen(reserves)

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {openCount} réserve{openCount > 1 ? 's' : ''} ouverte{openCount > 1 ? 's' : ''} / {reserves.length}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
        >
          <Plus size={16} /> Réserve
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '12px', background: '#fff' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <select value={dLot} onChange={e => setDLot(e.target.value)} style={selStyle}>
              {LOTS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={dLogement} onChange={e => setDLogement(e.target.value)} style={selStyle}>
              {LOGEMENTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <textarea
            value={dDesc}
            onChange={e => setDDesc(e.target.value)}
            placeholder="Description de la réserve..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px', fontFamily: 'inherit', minHeight: '60px', boxSizing: 'border-box', marginBottom: '8px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {(Object.keys(PRIORITY_META) as ReservePriority[]).map(p => (
              <button
                key={p}
                onClick={() => setDPriority(p)}
                style={{ flex: 1, padding: '6px', borderRadius: '6px', border: dPriority === p ? `2px solid ${PRIORITY_META[p].fg}` : '1px solid var(--line)', background: dPriority === p ? PRIORITY_META[p].bg : '#fff', color: PRIORITY_META[p].fg, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }}
            >
              <Camera size={14} /> {dPhoto ? 'Photo ✓' : 'Photo'}
            </button>
            {dPhoto && <img src={dPhoto} alt="aperçu" style={{ height: '36px', borderRadius: '4px' }} />}
            <div style={{ flex: 1 }} />
            <button onClick={addReserve} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--ok)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
        {(['all', 'open', 'resolved'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={chip(filterStatus === s)}>
            {s === 'all' ? 'Toutes' : s === 'open' ? 'Ouvertes' : 'Levées'}
          </button>
        ))}
        <div style={{ width: '1px', background: 'var(--line)', margin: '0 2px' }} />
        <button onClick={() => setFilterLot(null)} style={chip(!filterLot)}>Tous lots</button>
        {LOTS.map(l => (
          <button key={l.id} onClick={() => setFilterLot(l.id)} style={chip(filterLot === l.id)}>{l.id}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visible.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', background: '#f9fbfd', borderRadius: '8px', border: '1px solid var(--line)' }}>
            Aucune réserve.
          </div>
        )}
        {visible.map(r => {
          const pm = PRIORITY_META[r.priority]
          return (
            <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', background: r.status === 'resolved' ? '#f7faf8' : '#fff', opacity: r.status === 'resolved' ? 0.75 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--navy)', fontSize: '13px' }}>{r.number}</strong>
                    <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, background: pm.bg, color: pm.fg }}>{pm.label}</span>
                    {r.status === 'resolved' && <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, background: 'var(--ok-bg)', color: 'var(--ok)' }}>Levée</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink)', marginBottom: '6px', textDecoration: r.status === 'resolved' ? 'line-through' : 'none' }}>{r.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)' }}>
                    <MapPin size={11} /> {logementLabel(r.logementId)} • {lotName(r.lotId)}
                  </div>
                </div>
                {r.photo && <img src={r.photo} alt="réserve" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px' }} />}
              </div>
              <button
                onClick={() => toggleStatus(r.id)}
                style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: r.status === 'open' ? 'var(--ok)' : 'var(--muted)', cursor: 'pointer' }}
              >
                {r.status === 'open' ? <><Check size={13} /> Marquer levée</> : <><X size={13} /> Rouvrir</>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const selStyle: React.CSSProperties = { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', background: '#fff', color: 'var(--navy)' }
const chip = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: '16px', border: on ? '1px solid var(--navy)' : '1px solid var(--line)', background: on ? 'var(--navy)' : '#fff', color: on ? '#fff' : 'var(--muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' })
