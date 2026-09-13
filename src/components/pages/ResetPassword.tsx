import { useState, type FormEvent } from 'react'
import { KeyRound, Check } from 'lucide-react'
import { changeOwnPasswordRemote, signOutRemote } from '../../lib/supabaseAuth'

interface Props {
  /** Appelé une fois le mot de passe changé (retour à la connexion). */
  onDone: () => void
}

/**
 * Choix d'un nouveau mot de passe après avoir suivi le lien de réinitialisation.
 * Supabase a ouvert une session « recovery » ; on met à jour puis on déconnecte.
 */
export function ResetPassword({ onDone }: Props) {
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (next !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setBusy(true); setError(null)
    const { error: err } = await changeOwnPasswordRemote(next)
    if (err) { setBusy(false); setError('La mise à jour a échoué. Le lien a peut-être expiré.'); return }
    await signOutRemote()
    setBusy(false)
    onDone()
  }

  return (
    <div className="auth-shell" style={{ background: 'linear-gradient(180deg, #02457A 0%, #001B48 100%)' }}>
      <form onSubmit={submit} className="card auth-card" style={{ background: '#fff', borderRadius: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#018ABE', fontWeight: 700 }}>
            Suivi Chantier
          </div>
          <h1 style={{ fontSize: '20px', color: '#02457A', margin: '4px 0 2px' }}>Nouveau mot de passe</h1>
          <div style={{ fontSize: '12px', color: '#5b7183' }}>Choisissez votre nouveau mot de passe</div>
        </div>

        <label style={label}>Nouveau mot de passe</label>
        <input type="password" value={next} onChange={e => setNext(e.target.value)} autoFocus
          placeholder="8 caractères minimum" style={field} />
        <label style={label}>Confirmer</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={field} />

        {error && <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}

        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: busy ? '#5b7183' : '#02457A',
          color: '#fff', fontSize: '15px', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          {busy ? <KeyRound size={16} /> : <Check size={16} />} {busy ? 'Mise à jour…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#5b7183', marginBottom: '5px',
}
const field: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: '9px', border: '1px solid #d1dce5',
  fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '14px', background: '#fff',
}
