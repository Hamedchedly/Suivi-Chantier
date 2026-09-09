import { useState } from 'react'
import { Plus, Calendar, Users, MapPin, ChevronRight } from 'lucide-react'

type CRStep = 'list' | 'presences' | 'zone' | 'lots'

interface VisitDraft {
  date: string
  presences: string[]
  zones: string[]
}

const RECENT_VISITS = [
  { id: 'V003', date: '09/09/2026', lots: 4, status: 'brouillon' as const },
  { id: 'V002', date: '04/09/2026', lots: 5, status: 'envoyé'   as const },
  { id: 'V001', date: '28/08/2026', lots: 5, status: 'envoyé'   as const },
]

const INTERVENANTS = ['Jean Dupont (MOE)', 'Marie Martin (MOA)', 'Paul Bernard (Entreprise)', 'Sophie Girard (OPC)']

export function CR() {
  const [step, setStep] = useState<CRStep>('list')
  const [draft, setDraft] = useState<VisitDraft>({
    date: new Date().toISOString().split('T')[0],
    presences: [],
    zones: [],
  })

  if (step === 'presences') {
    return (
      <div style={{ padding: '12px', paddingBottom: '80px' }}>
        <div className="app-shell" style={{ maxWidth: '100%' }}>
          <button onClick={() => setStep('list')} style={{ background: 'none', border: 'none', color: 'var(--navy-2)', cursor: 'pointer', fontSize: '13px', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Retour
          </button>
          <h2 style={{ margin: '0 0 4px' }}>Nouvelle visite</h2>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px' }}>Étape 1 / 3 — Présences</p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Date de visite</label>
            <input
              type="date"
              value={draft.date}
              onChange={e => setDraft({ ...draft, date: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Présents</label>
            {INTERVENANTS.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '6px', background: draft.presences.includes(p) ? 'var(--ok-bg)' : '#fff', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.presences.includes(p)}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...draft.presences, p]
                      : draft.presences.filter(x => x !== p)
                    setDraft({ ...draft, presences: next })
                  }}
                />
                <span style={{ fontSize: '13px' }}>{p}</span>
              </label>
            ))}
          </div>

          <button
            onClick={() => setStep('zone')}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
          >
            Suivant → Zone de visite
          </button>
        </div>
      </div>
    )
  }

  if (step === 'zone') {
    const ZONES = ['Bâtiment A', 'Bâtiment B', 'Extérieurs', 'Sous-sol', 'Toiture', 'Zone technique']
    return (
      <div style={{ padding: '12px', paddingBottom: '80px' }}>
        <button onClick={() => setStep('presences')} style={{ background: 'none', border: 'none', color: 'var(--navy-2)', cursor: 'pointer', fontSize: '13px', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Retour
        </button>
        <h2 style={{ margin: '0 0 4px' }}>Zones visitées</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px' }}>Étape 2 / 3 — Sélectionnez les zones</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {ZONES.map(z => (
            <label key={z} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)', background: draft.zones.includes(z) ? 'var(--ok-bg)' : '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={draft.zones.includes(z)}
                onChange={e => {
                  const next = e.target.checked
                    ? [...draft.zones, z]
                    : draft.zones.filter(x => x !== z)
                  setDraft({ ...draft, zones: next })
                }}
              />
              <span style={{ fontSize: '13px' }}>{z}</span>
            </label>
          ))}
        </div>

        <button
          onClick={() => setStep('lots')}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
        >
          Suivant → Constat par lot
        </button>
      </div>
    )
  }

  if (step === 'lots') {
    return (
      <div style={{ padding: '12px', paddingBottom: '80px' }}>
        <button onClick={() => setStep('zone')} style={{ background: 'none', border: 'none', color: 'var(--navy-2)', cursor: 'pointer', fontSize: '13px', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Retour
        </button>
        <h2 style={{ margin: '0 0 4px' }}>Constat par lot</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px' }}>Étape 3 / 3 — Saisie des observations</p>

        {['LOT 05 — Menuiseries ext.', 'LOT 06 — Cloisons', 'LOT 07 — Électricité', 'LOT 08 — Peinture'].map(lot => (
          <div key={lot} style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '10px', background: '#fff' }}>
            <div style={{ fontWeight: '600', color: 'var(--navy)', fontSize: '13px', marginBottom: '8px' }}>{lot}</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              {['RAS', 'Réserve', 'Point bloquant'].map(status => (
                <button key={status} style={{ flex: 1, padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer', color: 'var(--muted)' }}>
                  {status}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Observations..."
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', fontFamily: 'inherit', minHeight: '60px', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
        ))}

        <button
          onClick={() => setStep('list')}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--ok)', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}
        >
          Enregistrer le CR
        </button>
      </div>
    )
  }

  // Default: list view
  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--navy)', marginBottom: '4px' }}>Comptes Rendus</h1>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Visites de chantier</div>
      </div>

      <button
        onClick={() => setStep('presences')}
        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}
      >
        <Plus size={18} />
        Nouvelle visite de chantier
      </button>

      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
        Visites récentes
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {RECENT_VISITS.map(v => (
          <div
            key={v.id}
            style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={18} color="var(--muted)" />
              <div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--navy)' }}>Visite du {v.date}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{v.lots} lots inspectés</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', background: v.status === 'envoyé' ? 'var(--ok-bg)' : 'var(--warn-bg)', color: v.status === 'envoyé' ? 'var(--ok)' : 'var(--warn)' }}>
                {v.status === 'envoyé' ? 'Envoyé' : 'Brouillon'}
              </span>
              <ChevronRight size={14} color="var(--muted)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
