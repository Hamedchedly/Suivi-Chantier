import { useState, type FormEvent } from 'react'
import { ArrowLeft, Send, CircleCheck } from 'lucide-react'
import { submitDemoRequest } from '../../lib/supabaseAuth'

interface Props {
  onBack: () => void
  onSignIn: () => void
}

/**
 * « Demander une démo » = auto-inscription. Le demandeur choisit son mot de passe ;
 * le compte est créé en attente et activé ensuite par un super-administrateur.
 */
export function DemoRequest({ onBack, onSignIn }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const ERRORS: Record<string, string> = {
    email_invalide: 'Adresse e-mail invalide.',
    mot_de_passe_court: 'Le mot de passe doit faire au moins 8 caractères.',
    email_deja_utilise: 'Un compte existe déjà pour cette adresse.',
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Indiquez votre nom.'); return }
    if (!email.trim()) { setError('Indiquez votre adresse e-mail.'); return }
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setBusy(true); setError(null)
    const { error: err } = await submitDemoRequest({ name, email, password, company, message })
    setBusy(false)
    if (err) { setError(ERRORS[err] ?? "L'envoi a échoué. Réessayez dans un instant."); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="auth-shell" style={{ background: 'linear-gradient(180deg, #02457A 0%, #001B48 100%)' }}>
        <div className="card auth-card" style={{ background: '#fff', borderRadius: '16px', textAlign: 'center' }}>
          <CircleCheck size={44} color="#16a34a" style={{ margin: '4px auto 10px' }} />
          <h1 style={{ fontSize: '20px', color: '#02457A', margin: '0 0 8px' }}>Demande envoyée</h1>
          <p style={{ fontSize: '13.5px', color: '#5b7183', lineHeight: 1.55, margin: '0 0 18px' }}>
            Merci {name.split(' ')[0]}. Votre compte a été créé et attend la validation d'un
            administrateur. Vous pourrez vous connecter avec votre e-mail et votre mot de passe
            dès qu'il sera activé.
          </p>
          <button onClick={onSignIn} style={primary(false)}>Aller à la connexion</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell" style={{ background: 'linear-gradient(180deg, #02457A 0%, #001B48 100%)' }}>
      <form onSubmit={submit} className="card auth-card" style={{ background: '#fff', borderRadius: '16px' }}>
        <button type="button" onClick={onBack} style={backBtn}>
          <ArrowLeft size={15} /> Accueil
        </button>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#018ABE', fontWeight: 700 }}>
            Suivi Chantier
          </div>
          <h1 style={{ fontSize: '20px', color: '#02457A', margin: '4px 0 2px' }}>Demander une démo</h1>
          <div style={{ fontSize: '12px', color: '#5b7183' }}>Créez votre accès — activé après validation</div>
        </div>

        <label style={label}>Nom et prénom</label>
        <input value={name} onChange={e => setName(e.target.value)} autoFocus style={field} />
        <label style={label}>Adresse e-mail</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoCapitalize="none" autoCorrect="off"
          placeholder="prenom.nom@entreprise.fr" style={field} />
        <label style={label}>Société <span style={{ fontWeight: 400, color: '#9db0c2' }}>(facultatif)</span></label>
        <input value={company} onChange={e => setCompany(e.target.value)} style={field} />
        <label style={label}>Mot de passe</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password"
          placeholder="8 caractères minimum" style={field} />
        <label style={label}>Confirmer le mot de passe</label>
        <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password" style={field} />
        <label style={label}>Votre besoin <span style={{ fontWeight: 400, color: '#9db0c2' }}>(facultatif)</span></label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
          placeholder="Type d'opération, rôle, ce que vous souhaitez suivre…"
          style={{ ...field, resize: 'vertical' }} />

        {error && <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}

        <button type="submit" disabled={busy} style={primary(busy)}>
          <Send size={16} /> {busy ? 'Envoi…' : 'Envoyer la demande'}
        </button>
        <button type="button" onClick={onSignIn} style={{
          border: 'none', background: 'none', color: '#018ABE', fontSize: '12.5px', fontWeight: 600,
          cursor: 'pointer', padding: 0, marginTop: '12px', display: 'block', width: '100%', textAlign: 'center',
        }}>
          J'ai déjà un compte — me connecter
        </button>
      </form>
    </div>
  )
}

const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none',
  color: '#5b7183', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: '10px',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#5b7183', marginBottom: '5px',
}
const field: React.CSSProperties = {
  width: '100%', padding: '11px', borderRadius: '9px', border: '1px solid #d1dce5',
  fontSize: '14.5px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '12px', background: '#fff',
}
const primary = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: busy ? '#5b7183' : '#02457A',
  color: '#fff', fontSize: '15px', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
})
