import { useState } from 'react'
import { Mail, KeyRound, Check, ShieldAlert } from 'lucide-react'
import {
  User, AuthError, AUTH_ERROR_LABEL, ROLE_LABEL, setEmail, changeOwnPassword,
} from '../../lib/auth'

interface Props {
  users: User[]
  currentUser: User
  onChange: (users: User[]) => void
}

/** The signed-in user's own settings: contact address and password. */
export function MonCompte({ users, currentUser, onChange }: Props) {
  const [email, setEmailValue] = useState(currentUser.email ?? '')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<AuthError | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const saveEmail = () => {
    const r = setEmail(users, currentUser.id, email)
    if (!r.ok) { setError(r.error ?? null); setDone(null); return }
    setError(null); setDone('Adresse e-mail enregistrée.')
    onChange(r.users)
  }

  const savePassword = () => {
    const r = changeOwnPassword(users, currentUser.id, current, next, confirm)
    if (!r.ok) { setError(r.error ?? null); setDone(null); return }
    setError(null); setDone('Mot de passe modifié.')
    setCurrent(''); setNext(''); setConfirm('')
    onChange(r.users)
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={card}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#02457A', marginBottom: '2px' }}>
          {currentUser.displayName}
        </div>
        <div style={{ fontSize: '11px', color: '#5b7183' }}>
          identifiant <code>{currentUser.username}</code> · {ROLE_LABEL[currentUser.role]}
        </div>
      </div>

      {error && (
        <div style={{ ...notice, background: '#fdecec', border: '1px solid #f5c2c2', color: '#b91c1c' }}>
          {AUTH_ERROR_LABEL[error]}
        </div>
      )}
      {done && (
        <div style={{ ...notice, background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }}>
          <Check size={14} style={{ verticalAlign: '-2px', marginRight: '5px' }} />{done}
        </div>
      )}

      <div style={card}>
        <div style={title}><Mail size={15} /> Adresse e-mail</div>
        <p style={hint}>Sert à vous identifier et à recevoir les comptes rendus diffusés.</p>
        <input
          type="email" value={email} onChange={e => setEmailValue(e.target.value)}
          placeholder="prenom.nom@entreprise.fr" autoCapitalize="none"
          style={field}
        />
        <button onClick={saveEmail} style={primary}>Enregistrer l'adresse</button>
      </div>

      <div style={card}>
        <div style={title}><KeyRound size={15} /> Mot de passe</div>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
          placeholder="Mot de passe actuel" style={field} />
        <input type="password" value={next} onChange={e => setNext(e.target.value)}
          placeholder="Nouveau mot de passe" style={field} />
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="Confirmer le nouveau mot de passe" style={field}
          onKeyDown={e => { if (e.key === 'Enter') savePassword() }} />
        <button onClick={savePassword} style={primary}>Modifier le mot de passe</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '11px 12px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <ShieldAlert size={15} color="#c2410c" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '11px', color: '#9a3412', lineHeight: 1.45 }}>
          Ces informations sont enregistrées dans ce navigateur, en clair. Elles organisent
          l'accès à l'interface sans protéger les données.
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e4ecf2', borderRadius: '12px',
  padding: '14px 16px', marginBottom: '14px',
}

const title: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '7px',
  fontSize: '13px', fontWeight: 700, color: '#02457A', marginBottom: '4px',
}

const hint: React.CSSProperties = { fontSize: '11px', color: '#5b7183', margin: '0 0 10px' }

const field: React.CSSProperties = {
  width: '100%', padding: '11px', borderRadius: '9px', border: '1px solid #d1dce5',
  fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '9px', background: '#fff',
}

const primary: React.CSSProperties = {
  width: '100%', padding: '11px', borderRadius: '9px', border: 'none',
  background: '#02457A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
}

const notice: React.CSSProperties = {
  padding: '10px 12px', borderRadius: '9px', fontSize: '12px', fontWeight: 600, marginBottom: '14px',
}
