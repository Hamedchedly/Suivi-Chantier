import { useState, useEffect, useCallback } from 'react'
import { Inbox, Check, X, Building2, Mail, Clock, SlidersHorizontal } from 'lucide-react'
import { Feature, ALL_FEATURES, FEATURE_LABEL } from '../../lib/auth'
import {
  DemoRequest, listDemoRequests, approveDemoRequest, rejectDemoRequest,
} from '../../lib/supabaseAuth'
import { logActivity } from '../../lib/repo'
import { badge, sectionLabel, ghostBtn } from '../visite/visiteStyles'
import { Empty } from '../visite/visiteBits'

const STATUS_LABEL: Record<DemoRequest['status'], string> = {
  pending: 'En attente', approved: 'Validée', rejected: 'Refusée',
}
const STATUS_STYLE: Record<DemoRequest['status'], React.CSSProperties> = {
  pending: { background: '#fff7ed', color: '#c2410c' },
  approved: { background: '#dcfce7', color: '#15803d' },
  rejected: { background: '#fdecec', color: '#dc2626' },
}

/** Console super-admin : demandes de démo (auto-inscriptions) à valider. */
export function DemoRequests() {
  const [list, setList] = useState<DemoRequest[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [approveFor, setApproveFor] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setBusy(true)
    try { setList(await listDemoRequests()) } finally { setBusy(false) }
  }, [])
  useEffect(() => { reload() }, [reload])

  const pending = list.filter(r => r.status === 'pending').length

  const approve = async (req: DemoRequest, features: Feature[]) => {
    setMsg(null); setApproveFor(null)
    const { error } = await approveDemoRequest(req, features)
    if (error) { setMsg(error); return }
    logActivity('doc', `Demande de démo validée : ${req.email}`)
    await reload()
  }

  const reject = async (req: DemoRequest) => {
    if (!window.confirm(`Refuser et supprimer la demande de « ${req.email} » ?`)) return
    setMsg(null)
    const { error } = await rejectDemoRequest(req)
    if (error) { setMsg(error); return }
    logActivity('doc', `Demande de démo refusée : ${req.email}`)
    await reload()
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', gap: '8px', padding: '11px 12px', borderRadius: '10px', background: '#eef4fb', border: '1px solid #d3e3f2', marginBottom: '16px' }}>
        <Inbox size={16} color="#02457A" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '11px', color: '#274b6b', lineHeight: 1.45 }}>
          Demandes d'accès (auto-inscriptions). Validez pour activer le compte et ouvrir les
          modules ; refusez pour supprimer le compte en attente.{busy ? ' Chargement…' : ''}
        </div>
      </div>

      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#fdecec', border: '1px solid #f5c2c2', color: '#b91c1c', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      <div style={sectionLabel}>Demandes ({pending} en attente · {list.length} au total)</div>
      {list.length === 0 && <Empty>{busy ? 'Chargement…' : 'Aucune demande.'}</Empty>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {list.map(req => (
          <div key={req.id} style={{ padding: '13px 14px', borderRadius: '11px', border: '1px solid var(--line)', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>{req.name || req.email}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {req.email}</span>
                  {req.company && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} /> {req.company}</span>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(req.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
              <span style={{ ...badge, ...STATUS_STYLE[req.status] }}>{STATUS_LABEL[req.status]}</span>
            </div>

            {req.message && (
              <div style={{ fontSize: '12.5px', color: '#42607d', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', lineHeight: 1.5 }}>
                {req.message}
              </div>
            )}

            {req.status === 'pending' && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button onClick={() => setApproveFor(approveFor === req.id ? null : req.id)}
                    style={{ ...ghostBtn, borderColor: '#a7f3d0', color: '#047857' }}>
                    <SlidersHorizontal size={14} /> Valider & choisir les modules
                  </button>
                  <button onClick={() => reject(req)} style={{ ...ghostBtn, borderColor: '#f5c2c2', color: '#dc2626' }}>
                    <X size={14} /> Refuser
                  </button>
                </div>
                {approveFor === req.id && (
                  <ApproveForm onConfirm={features => approve(req, features)} onCancel={() => setApproveFor(null)} />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ApproveForm({ onConfirm, onCancel }: { onConfirm: (f: Feature[]) => void; onCancel: () => void }) {
  const [sel, setSel] = useState<Set<Feature>>(new Set(ALL_FEATURES))
  const toggle = (f: Feature) => {
    const next = new Set(sel)
    if (next.has(f)) next.delete(f); else next.add(f)
    setSel(next)
  }
  return (
    <div style={{ marginTop: '10px', padding: '10px', borderRadius: '9px', border: '1px solid var(--line)', background: '#f8fafc' }}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
        Modules ouverts à ce compte (Accueil et Mes opérations restent toujours accessibles).
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px' }}>
        {ALL_FEATURES.map(f => {
          const on = sel.has(f)
          return (
            <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 9px', borderRadius: '8px', cursor: 'pointer',
              border: on ? '1px solid var(--accent)' : '1px solid var(--line)', background: on ? 'var(--sky-soft)' : '#fff', fontSize: '12px', color: 'var(--navy)' }}>
              <input type="checkbox" checked={on} onChange={() => toggle(f)} style={{ accentColor: 'var(--accent)' }} />
              {FEATURE_LABEL[f]}
            </label>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button onClick={onCancel} style={ghostBtn}>Annuler</button>
        <button onClick={() => onConfirm([...sel])} style={{ ...ghostBtn, borderColor: '#a7f3d0', color: '#047857' }}>
          <Check size={14} /> Valider la demande
        </button>
      </div>
    </div>
  )
}
