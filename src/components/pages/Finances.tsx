import { useState, useEffect } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import {
  Marche, Avenant, Situation, AvenantStatus,
  projectFinance, marcheFinance, euros,
} from '../../lib/finance'
import {
  getMarches, saveMarches, getAvenants, saveAvenants, getSituations, saveSituations,
  getLotsConfig, logActivity,
} from '../../lib/repo'
import { SavedIndicator } from '../common/SavedIndicator'
import { DpgfView } from './DpgfView'

type FinSection = 'marches' | 'avenants' | 'situations' | 'dpgf'

const AVENANT_META: Record<AvenantStatus, { label: string; bg: string; fg: string }> = {
  proposed: { label: 'Proposé', bg: '#fef3c7', fg: '#b45309' },
  approved: { label: 'Validé', bg: '#dcfce7', fg: '#15803d' },
  rejected: { label: 'Rejeté', bg: '#fdecec', fg: '#dc2626' },
}

const lotShort = (lotId: string) => lotId.replace('L', 'LOT ')

export function Finances() {
  const [section, setSection] = useState<FinSection>('marches')
  const [marches, setMarches] = useState<Marche[]>(getMarches)
  const [avenants, setAvenants] = useState<Avenant[]>(getAvenants)
  const [situations, setSituations] = useState<Situation[]>(getSituations)
  const [lots] = useState(getLotsConfig)
  const [form, setForm] = useState<{ lotId: string; amountHT: string } | null>(null)

  useEffect(() => { saveMarches(marches) }, [marches])
  useEffect(() => { saveAvenants(avenants) }, [avenants])
  useEffect(() => { saveSituations(situations) }, [situations])

  const addMarche = () => {
    if (!form) return
    const lot = lots.find(l => l.id === form.lotId)
    const amountHT = Math.max(0, parseFloat(form.amountHT.replace(',', '.')) || 0)
    const m: Marche = { id: `m${Date.now()}`, lotId: form.lotId, company: lot?.company || '', amountHT }
    setMarches(prev => [...prev, m])
    logActivity('finance', `Marché créé — ${form.lotId} (${euros(amountHT)})`)
    setForm(null)
  }
  const removeMarche = (id: string) => setMarches(prev => prev.filter(m => m.id !== id))

  const pf = projectFinance(marches, avenants, situations)
  const donutData = [
    { name: 'Payé', value: Math.max(0, pf.paid), color: '#15803d' },
    { name: 'Facturé non payé', value: Math.max(0, pf.billed - pf.paid), color: '#018ABE' },
    { name: 'Reste', value: Math.max(0, pf.remaining), color: '#D6E8EE' },
  ]

  const approveAvenant = (id: string) =>
    setAvenants(prev => prev.map(a => {
      if (a.id !== id) return a
      logActivity('finance', `Avenant validé — ${a.label} (${a.amountHT >= 0 ? '+' : ''}${euros(a.amountHT)})`)
      return { ...a, status: 'approved' }
    }))
  const toggleSituation = (id: string) =>
    setSituations(prev => prev.map(s => {
      if (s.id !== id) return s
      const status = s.status === 'paid' ? 'pending' as const : 'paid' as const
      logActivity('finance', `Situation N°${s.number} ${status === 'paid' ? 'marquée payée' : 'remise en attente'}`)
      return { ...s, status }
    }))

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '12px' }}>
        <Kpi label="Budget (HT)" value={euros(pf.budget)} />
        <Kpi label="Facturé" value={euros(pf.billed)} sub={`${pf.billedPct}%`} />
        <Kpi label="Payé" value={euros(pf.paid)} variant="ok" />
        <Kpi label="Reste à facturer" value={euros(pf.remaining)} variant="warn" />
      </div>

      {/* Budget donut */}
      <div className="card" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '112px', height: '112px', flexShrink: 0, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData} dataKey="value" cx="50%" cy="50%"
                innerRadius={38} outerRadius={54} startAngle={90} endAngle={-270} stroke="none"
              >
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>{pf.billedPct}%</div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>facturé</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <DonutRow color="var(--ok)" label="Payé" value={euros(pf.paid)} />
          <DonutRow color="var(--accent)" label="Facturé non payé" value={euros(pf.billed - pf.paid)} />
          <DonutRow color="var(--sky-soft)" label="Reste à facturer" value={euros(pf.remaining)} />
          {pf.avenants !== 0 && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>dont avenants validés : {euros(pf.avenants)}</div>}
        </div>
      </div>

      {/* Segmented */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: '#eef2f6', padding: '3px', borderRadius: '8px', overflowX: 'auto' }}>
        {(['marches', 'avenants', 'situations', 'dpgf'] as const).map(s => (
          <button key={s} onClick={() => setSection(s)} style={seg(section === s)}>
            {s === 'marches' ? 'Marchés' : s === 'avenants' ? 'Avenants' : s === 'situations' ? 'Situations' : 'DPGF'}
          </button>
        ))}
      </div>

      {section === 'dpgf' && <DpgfView />}

      {/* Marchés */}
      {section === 'marches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <SavedIndicator watch={marches} />
            {!form && (
              <button onClick={() => setForm({ lotId: lots[0]?.id ?? '', amountHT: '' })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', border: 'none', background: 'var(--navy)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
                <Plus size={15} /> Ajouter un marché
              </button>
            )}
          </div>

          {form && (
            <div style={{ ...card, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={form.lotId} onChange={e => setForm({ ...form, lotId: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px', flex: '1 1 160px' }}>
                {lots.length === 0 && <option value="">Aucun lot — créez-en dans Configuration</option>}
                {lots.map(l => <option key={l.id} value={l.id}>{l.id} — {l.company || l.name}</option>)}
              </select>
              <input type="number" min={0} inputMode="decimal" placeholder="Montant HT (€)" value={form.amountHT}
                onChange={e => setForm({ ...form, amountHT: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px', width: '150px' }} />
              <button onClick={addMarche} disabled={!form.lotId}
                style={{ padding: '8px 14px', borderRadius: '7px', border: 'none', background: form.lotId ? 'var(--accent)' : '#e8eef4', color: form.lotId ? '#fff' : 'var(--muted)', fontSize: '13px', fontWeight: 700, cursor: form.lotId ? 'pointer' : 'default' }}>
                Créer
              </button>
              <button onClick={() => setForm(null)} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Annuler</button>
            </div>
          )}

          {marches.length === 0 && !form && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '18px', border: '1px dashed var(--line)', borderRadius: '10px' }}>
              Aucun marché. Ajoutez le marché de chaque lot pour suivre facturation et paiements.
            </div>
          )}

          {marches.map(m => {
            const f = marcheFinance(m, avenants, situations)
            return (
              <div key={m.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '13px' }}>{lotShort(m.lotId)}{m.company ? ` — ${m.company}` : ''}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Montant marché : {euros(f.amount)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--navy-2)', fontSize: '14px' }}>{f.billedPct}%</div>
                    <button onClick={() => removeMarche(m.id)} title="Supprimer le marché" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b42318', padding: '2px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--line)', overflow: 'hidden', margin: '8px 0 4px' }}>
                  <div style={{ width: `${f.billedPct}%`, height: '100%', background: 'var(--navy2)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                  <span>Facturé {euros(f.billed)}</span>
                  <span>Payé {euros(f.paid)}</span>
                  <span>Reste {euros(f.remaining)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Avenants */}
      {section === 'avenants' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {avenants.map(a => {
            const meta = AVENANT_META[a.status]
            const marche = marches.find(m => m.id === a.marcheId)
            return (
              <div key={a.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, background: meta.bg, color: meta.fg }}>{meta.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{marche ? lotShort(marche.lotId) : a.marcheId}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--ink)' }}>{a.label}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: a.amountHT >= 0 ? 'var(--navy-2)' : 'var(--bad)' }}>
                    {a.amountHT >= 0 ? '+' : ''}{euros(a.amountHT)}
                  </div>
                </div>
                {a.status === 'proposed' && (
                  <button onClick={() => approveAvenant(a.id)} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--ok)', cursor: 'pointer' }}>
                    <Check size={13} /> Valider l'avenant
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Situations */}
      {section === 'situations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {situations.map(s => {
            const marche = marches.find(m => m.id === s.marcheId)
            return (
              <div key={s.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '13px' }}>
                      Situation N°{s.number} — {marche ? lotShort(marche.lotId) : s.marcheId}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{new Date(s.date).toLocaleDateString('fr')} • {euros(s.amountHT)}</div>
                  </div>
                  <button
                    onClick={() => toggleSituation(s.id)}
                    style={{ padding: '5px 10px', borderRadius: '14px', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: s.status === 'paid' ? 'var(--ok-bg)' : 'var(--warn-bg)', color: s.status === 'paid' ? 'var(--ok)' : 'var(--warn)' }}
                  >
                    {s.status === 'paid' ? 'Payée' : 'En attente'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, variant }: { label: string; value: string; sub?: string; variant?: 'ok' | 'warn' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${variant || ''}`} style={{ fontSize: '18px' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>{sub}</div>}
    </div>
  )
}

function DonutRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, flexShrink: 0 }} />
      <span style={{ color: 'var(--muted)', flex: 1 }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{value}</span>
    </div>
  )
}

const card: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: '14px', padding: '14px', background: '#fff', boxShadow: 'var(--shadow-sm)' }
const seg = (on: boolean): React.CSSProperties => ({ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#02457A' : '#5b7183', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none' })
