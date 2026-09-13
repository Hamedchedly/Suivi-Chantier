import { useState, type FormEvent } from 'react'
import { ArrowLeft, MailCheck, Send } from 'lucide-react'
import { requestPasswordReset } from '../../lib/supabaseAuth'

interface Props {
  onBack: () => void
}

/** Demande de réinitialisation : envoie un e-mail avec un lien de réinitialisation. */
export function ForgotPassword({ onBack }: Props) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Indiquez votre adresse e-mail.'); return }
    setBusy(true); setError(null)
    const { error: err } = await requestPasswordReset(email)
    setBusy(false)
    if (err) { setError("L'envoi a échoué. Réessayez dans un instant."); return }
    setSent(true)
  }

  return (
    <div className="auth-shell" style={{ background: 'linear-gradient(180deg, #02457A 0%, #001B48 100%)' }}>
      <form onSubmit={submit} className="card auth-card" style={{ background: '#fff', borderRadius: '16px' }}>
        <button type="button" onClick={onBack} style={backBtn}>
          <ArrowLeft size={15} /> Connexion
        </button>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#018ABE', fontWeight: 700 }}>
            Suivi Chantier
          </div>
          <h1 style={{ fontSize: '20px', color: '#02457A', margin: '4px 0 2px' }}>Mot de passe oublié</h1>
          <div style={{ fontSize: '12px', color: '#5b7183' }}>On vous envoie un lien de réinitialisation</div>
        </div>

        {sent ? (
          <div style={{ display: 'flex', gap: '10px', padding: '14px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
            <MailCheck size={18} color="#047857" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '13px', color: '#065f46', lineHeight: 1.5 }}>
              Si un compte existe pour <strong>{email}</strong>, un e-mail vient d'être envoyé avec
              un lien pour choisir un nouveau mot de passe. Pensez à vérifier vos spams.
            </div>
          </div>
        ) : (
          <>
            <label style={label}>Adresse e-mail</label>
            <input
              value={email} onChange={e => setEmail(e.target.value)} type="email"
              autoCapitalize="none" autoCorrect="off" autoFocus placeholder="prenom.nom@entreprise.fr"
              style={field}
            />
            {error && <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
            <button type="submit" disabled={busy} style={primary(busy)}>
              <Send size={16} /> {busy ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </>
        )}
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
  width: '100%', padding: '12px', borderRadius: '9px', border: '1px solid #d1dce5',
  fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '14px', background: '#fff',
}
const primary = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: busy ? '#5b7183' : '#02457A',
  color: '#fff', fontSize: '15px', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
})
