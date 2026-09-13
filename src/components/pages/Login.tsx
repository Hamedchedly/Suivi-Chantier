import { useState, type FormEvent } from 'react'
import { LogIn, ShieldAlert, ShieldCheck } from 'lucide-react'
import { User, authenticate } from '../../lib/auth'
import { signInEmail } from '../../lib/supabaseAuth'

interface Props {
  /** Mode serveur (Supabase Auth) : connexion par e-mail + mot de passe. */
  remote: boolean
  users: User[]                       // mode local uniquement
  onSignIn: (u: User) => void         // mode local
  onRemoteSignedIn: () => void        // mode serveur : session ouverte
}

export function Login({ remote, users, onSignIn, onRemoteSignedIn }: Props) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!remote) {
      const user = authenticate(users, identifier, password)
      if (!user) { setError('Identifiant ou mot de passe incorrect.'); return }
      setError(null); onSignIn(user); return
    }
    setBusy(true); setError(null)
    const { error: err } = await signInEmail(identifier, password)
    setBusy(false)
    if (err) { setError('E-mail ou mot de passe incorrect.'); return }
    onRemoteSignedIn()
  }

  return (
    <div className="auth-shell" style={{ background: 'linear-gradient(180deg, #02457A 0%, #001B48 100%)' }}>
      <form onSubmit={submit} className="card auth-card" style={{ background: '#fff', borderRadius: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#018ABE', fontWeight: 700 }}>
            Suivi Chantier
          </div>
          <h1 style={{ fontSize: '20px', color: '#02457A', margin: '4px 0 2px' }}>Connexion</h1>
          <div style={{ fontSize: '12px', color: '#5b7183' }}>Suivi de chantier</div>
        </div>

        <label style={label}>{remote ? 'Adresse e-mail' : 'Identifiant'}</label>
        <input
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          type={remote ? 'email' : 'text'}
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
          style={field}
        />

        <label style={label}>Mot de passe</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={field} />

        {error && (
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, marginBottom: '10px' }}>{error}</div>
        )}

        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: busy ? '#5b7183' : '#02457A',
          color: '#fff', fontSize: '15px', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <LogIn size={17} /> {busy ? 'Connexion…' : 'Se connecter'}
        </button>

        {remote ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', padding: '10px 12px', borderRadius: '9px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
            <ShieldCheck size={15} color="#047857" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '11px', color: '#065f46', lineHeight: 1.45 }}>
              Connexion sécurisée au serveur. Vos données sont synchronisées et protégées côté Supabase.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', padding: '10px 12px', borderRadius: '9px', background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <ShieldAlert size={15} color="#c2410c" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '11px', color: '#9a3412', lineHeight: 1.45 }}>
              <strong>Prototype de démonstration.</strong> Les comptes vivent dans ce navigateur :
              cette connexion filtre l'affichage, elle ne protège pas les données.
              Comptes de test : <code>user / user</code> et <code>superadmin / superadmin</code>.
            </div>
          </div>
        )}
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
