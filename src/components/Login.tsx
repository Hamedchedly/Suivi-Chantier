import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setMessage(error.message)
        return
      }
      onSignedIn()
    } catch (loginError) {
      setMessage(loginError instanceof Error ? loginError.message : 'Erreur de connexion.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell auth-shell">
      <section className="panel auth-card">
        <p className="eyebrow">Suivi-Chantier</p>
        <h1>Connexion</h1>
        {message && <p className="notice error">{message}</p>}
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.fr"/></label>
          <label>Mot de passe<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••"/></label>
          <button type="submit" className="btn primary big" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        </form>
        <p className="muted small">Seuls les comptes membres d’une opération peuvent consulter ses données (RLS).</p>
      </section>
    </main>
  )
}

export function AccountBar({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="account">
      <span className="account-email">{email}</span>
      <button type="button" className="account-out" onClick={onSignOut}>Déconnexion</button>
    </div>
  )
}