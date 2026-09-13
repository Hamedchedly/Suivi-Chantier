import { useState, useEffect, useCallback } from 'react'
import {
  UserPlus, Shield, User as UserIcon, LogIn, Trash2, KeyRound, Ban, Check,
  ShieldAlert, ShieldCheck, X, SlidersHorizontal,
} from 'lucide-react'
import {
  User, UserRole, ROLE_LABEL, AUTH_ERROR_LABEL, AuthError,
  Feature, ALL_FEATURES, FEATURE_LABEL,
  createUser, deleteUser, setRole, setDisabled, setPassword, setFeatures,
} from '../../lib/auth'
import {
  adminListUsers, adminCreateUser, adminSetPassword, adminUpdateUser, adminDeleteUser,
} from '../../lib/supabaseAuth'
import { logActivity } from '../../lib/repo'
import { badge, sectionLabel, input, ghostBtn, bigBtnInline, linkBtn } from '../visite/visiteStyles'
import { Empty } from '../visite/visiteBits'

interface Props {
  users: User[]
  currentUser: User
  onChange: (users: User[]) => void
  onImpersonate: (target: User) => void
  /** Mode serveur : comptes gérés via la fonction Edge (Supabase). */
  remote?: boolean
}

/** Super-admin console: accounts, their rights, and signing in as one of them. */
export function Comptes({ users, currentUser, onChange, onImpersonate, remote }: Props) {
  const [error, setError] = useState<AuthError | null>(null)
  const [remoteMsg, setRemoteMsg] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pwFor, setPwFor] = useState<string | null>(null)
  const [featFor, setFeatFor] = useState<string | null>(null)
  const [list, setList] = useState<User[]>([])
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!remote) return
    setBusy(true)
    try { setList(await adminListUsers()) } finally { setBusy(false) }
  }, [remote])
  useEffect(() => { reload() }, [reload])

  const shown = remote ? list : users

  /** Exécute une opération serveur puis rafraîchit la liste. */
  const run = async (op: Promise<{ error?: string }>, done?: string) => {
    setError(null); setRemoteMsg(null)
    const { error: err } = await op
    if (err) { setRemoteMsg(err); return }
    if (done) logActivity('doc', done)
    await reload()
  }

  const apply = (result: { ok: boolean; users: User[]; error?: AuthError }, done?: string) => {
    if (!result.ok) { setError(result.error ?? null); return }
    setError(null)
    onChange(result.users)
    if (done) logActivity('doc', done)
  }

  // ── Handlers unifiés : branche serveur (Edge) ou local (localStorage) ──────
  const doCreate = (username: string, password: string, role: UserRole, displayName: string, email: string) => {
    if (remote) {
      setCreating(false)
      run(adminCreateUser({ email, password, role, display_name: displayName || undefined, features: role === 'user' ? ALL_FEATURES : undefined, username: username || undefined }), `Compte « ${email} » créé`)
      return
    }
    const r = createUser(users, { username, password, role, displayName, email })
    if (r.ok) setCreating(false)
    apply(r, `Compte « ${username} » créé (${ROLE_LABEL[role]})`)
  }

  const doToggleRole = (u: User, admin: boolean) => {
    const next: UserRole = admin ? 'user' : 'superadmin'
    const msg = `Rôle de « ${u.username} » : ${ROLE_LABEL[next]}`
    if (remote) { run(adminUpdateUser(u.id, { role: next }), msg); return }
    apply(setRole(users, u.id, next), msg)
  }

  const doToggleDisabled = (u: User) => {
    const msg = `Compte « ${u.username} » ${u.disabled ? 'réactivé' : 'désactivé'}`
    if (remote) { run(adminUpdateUser(u.id, { disabled: !u.disabled }), msg); return }
    apply(setDisabled(users, u.id, !u.disabled), msg)
  }

  const doDelete = (u: User) => {
    if (!window.confirm(`Supprimer le compte « ${u.username} » ?`)) return
    const msg = `Compte « ${u.username} » supprimé`
    if (remote) { run(adminDeleteUser(u.id), msg); return }
    apply(deleteUser(users, u.id, currentUser.id), msg)
  }

  const doSetPassword = (u: User, pw: string) => {
    setPwFor(null)
    const msg = `Mot de passe de « ${u.username} » modifié`
    if (remote) { run(adminSetPassword(u.id, pw), msg); return }
    apply(setPassword(users, u.id, pw), msg)
  }

  const doSetFeatures = (u: User, next: Feature[]) => {
    const msg = `Fonctionnalités de « ${u.username} » mises à jour`
    if (remote) { run(adminUpdateUser(u.id, { features: ALL_FEATURES.filter(f => next.includes(f)) }), msg); return }
    apply(setFeatures(users, u.id, next), msg)
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {remote ? (
        <div style={{ display: 'flex', gap: '8px', padding: '11px 12px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', marginBottom: '16px' }}>
          <ShieldCheck size={16} color="#047857" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '11px', color: '#065f46', lineHeight: 1.45 }}>
            Comptes gérés côté serveur (Supabase Auth). Les mots de passe sont chiffrés et les
            opérations d'administration exécutées de façon sécurisée.{busy ? ' Chargement…' : ''}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', padding: '11px 12px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: '16px' }}>
          <ShieldAlert size={16} color="#c2410c" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '11px', color: '#9a3412', lineHeight: 1.45 }}>
            Comptes et mots de passe sont stockés en clair dans ce navigateur. Ils organisent
            l'accès à l'interface ; ils ne protègent pas les données.
          </div>
        </div>
      )}

      {(error || remoteMsg) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#fdecec', border: '1px solid #f5c2c2', color: '#b91c1c', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
          {error ? AUTH_ERROR_LABEL[error] : remoteMsg}
          <button onClick={() => { setError(null); setRemoteMsg(null) }} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {!creating && (
        <button onClick={() => { setCreating(true); setError(null) }} style={{ ...bigBtnInline, width: '100%', background: 'var(--navy)', marginBottom: '18px' }}>
          <UserPlus size={17} /> Créer un compte
        </button>
      )}

      {creating && (
        <CreateForm
          remote={remote}
          onCancel={() => setCreating(false)}
          onCreate={doCreate}
        />
      )}

      <div style={sectionLabel}>Comptes ({shown.length})</div>
      {shown.length === 0 && <Empty>{busy ? 'Chargement…' : 'Aucun compte.'}</Empty>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {shown.map(u => {
          const isMe = u.id === currentUser.id
          const admin = u.role === 'superadmin'
          return (
            <div key={u.id} style={{ padding: '13px 14px', borderRadius: '11px', border: '1px solid var(--line)', background: u.disabled ? '#f8fafc' : '#fff', opacity: u.disabled ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
                {admin ? <Shield size={17} color="#6d28d9" /> : <UserIcon size={17} color="var(--muted)" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>
                    {u.displayName} {isMe && <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)' }}>— vous</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {remote
                      ? <>{u.email ?? u.id}{u.username && u.username !== u.email ? <> · id <code>{u.username}</code></> : ''}</>
                      : <>identifiant <code>{u.username}</code>{u.email ? ` · ${u.email}` : ''}</>}
                  </div>
                </div>
                <span style={{ ...badge, background: admin ? '#ede9fe' : '#eef2f6', color: admin ? '#6d28d9' : '#5b7183' }}>
                  {ROLE_LABEL[u.role]}
                </span>
                {u.disabled && <span style={{ ...badge, background: '#fdecec', color: '#dc2626' }}>Désactivé</span>}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {!remote && !isMe && !u.disabled && (
                  <button onClick={() => onImpersonate(u)} style={{ ...ghostBtn, borderColor: '#c7b9f0', color: '#6d28d9' }}>
                    <LogIn size={14} /> Se connecter en tant que
                  </button>
                )}
                <button onClick={() => doToggleRole(u, admin)} disabled={busy} style={ghostBtn}>
                  <Shield size={14} /> {admin ? 'Retirer les droits' : 'Passer super-admin'}
                </button>
                <button onClick={() => { setPwFor(pwFor === u.id ? null : u.id); setError(null) }} style={ghostBtn}>
                  <KeyRound size={14} /> Mot de passe
                </button>
                {!admin && (
                  <button onClick={() => { setFeatFor(featFor === u.id ? null : u.id); setError(null) }} style={ghostBtn}>
                    <SlidersHorizontal size={14} /> Fonctionnalités
                  </button>
                )}
                <button onClick={() => doToggleDisabled(u)} disabled={busy} style={ghostBtn}>
                  {u.disabled ? <Check size={14} /> : <Ban size={14} />} {u.disabled ? 'Réactiver' : 'Désactiver'}
                </button>
                {!isMe && (
                  <button onClick={() => doDelete(u)} disabled={busy}
                    style={{ ...ghostBtn, borderColor: '#f5c2c2', color: '#dc2626' }}>
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
              </div>

              {pwFor === u.id && (
                <PasswordForm
                  onCancel={() => setPwFor(null)}
                  onSet={pw => doSetPassword(u, pw)}
                />
              )}

              {featFor === u.id && !admin && (
                <FeaturesForm
                  value={u.features ?? ALL_FEATURES}
                  onToggle={next => doSetFeatures(u, next)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CreateForm({ remote, onCancel, onCreate }: {
  remote?: boolean
  onCancel: () => void
  onCreate: (username: string, password: string, role: UserRole, displayName: string, email: string) => void
}) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const canSubmit = remote ? !!(email.trim() && password) : !!(username.trim() && password)

  return (
    <div style={{ padding: '13px', borderRadius: '11px', border: '1px solid var(--line)', background: '#f8fafc', marginBottom: '18px' }}>
      <div style={sectionLabel}>Nouveau compte</div>
      <input value={username} onChange={e => setUsername(e.target.value)}
        placeholder={remote ? 'Identifiant court (facultatif)' : 'Identifiant'} autoCapitalize="none"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nom affiché (facultatif)"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoCapitalize="none"
        placeholder={remote ? 'Adresse e-mail (identifiant de connexion)' : 'Adresse e-mail (facultatif)'}
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" type="text"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {(['user', 'superadmin'] as UserRole[]).map(r => (
          <button key={r} onClick={() => setRole(r)} style={{
            flex: 1, padding: '11px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
            border: role === r ? '2px solid #02457A' : '1px solid var(--line)',
            background: role === r ? 'var(--sky-soft)' : '#fff',
            color: role === r ? '#02457A' : 'var(--muted)',
          }}>{ROLE_LABEL[r]}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Annuler</button>
        <button disabled={!canSubmit} onClick={() => onCreate(username, password, role, displayName, email)}
          style={{ ...bigBtnInline, background: 'var(--navy)', padding: '10px 15px', fontSize: '13px', opacity: canSubmit ? 1 : 0.5 }}>
          Créer
        </button>
      </div>
    </div>
  )
}

function FeaturesForm({ value, onToggle }: { value: Feature[]; onToggle: (next: Feature[]) => void }) {
  const set = new Set(value)
  const toggle = (f: Feature) => {
    const next = new Set(set)
    if (next.has(f)) next.delete(f); else next.add(f)
    onToggle([...next])
  }
  return (
    <div style={{ marginTop: '10px', padding: '10px', borderRadius: '9px', border: '1px solid var(--line)', background: '#f8fafc' }}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
        Modules accessibles à ce compte (Accueil et Mes opérations restent toujours ouverts).
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px' }}>
        {ALL_FEATURES.map(f => {
          const on = set.has(f)
          return (
            <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 9px', borderRadius: '8px', cursor: 'pointer',
              border: on ? '1px solid var(--accent)' : '1px solid var(--line)', background: on ? 'var(--sky-soft)' : '#fff', fontSize: '12px', color: 'var(--navy)' }}>
              <input type="checkbox" checked={on} onChange={() => toggle(f)} style={{ accentColor: 'var(--accent)' }} />
              {FEATURE_LABEL[f]}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function PasswordForm({ onCancel, onSet }: { onCancel: () => void; onSet: (pw: string) => void }) {
  const [pw, setPw] = useState('')
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
      <input autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="Nouveau mot de passe"
        onKeyDown={e => { if (e.key === 'Enter' && pw) onSet(pw) }}
        style={{ ...input, flex: 1 }} />
      <button disabled={!pw} onClick={() => onSet(pw)} style={{ ...ghostBtn, opacity: pw ? 1 : 0.5 }}>Définir</button>
      <button onClick={onCancel} style={ghostBtn}><X size={14} /></button>
    </div>
  )
}
