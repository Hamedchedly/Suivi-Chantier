import { useState } from 'react'
import {
  UserPlus, Shield, User as UserIcon, LogIn, Trash2, KeyRound, Ban, Check,
  ShieldAlert, X,
} from 'lucide-react'
import {
  User, UserRole, ROLE_LABEL, AUTH_ERROR_LABEL, AuthError,
  createUser, deleteUser, setRole, setDisabled, setPassword,
} from '../../lib/auth'
import { logActivity } from '../../lib/repo'
import { badge, sectionLabel, input, ghostBtn, bigBtnInline, linkBtn } from '../visite/visiteStyles'
import { Empty } from '../visite/visiteBits'

interface Props {
  users: User[]
  currentUser: User
  onChange: (users: User[]) => void
  onImpersonate: (target: User) => void
}

/** Super-admin console: accounts, their rights, and signing in as one of them. */
export function Comptes({ users, currentUser, onChange, onImpersonate }: Props) {
  const [error, setError] = useState<AuthError | null>(null)
  const [creating, setCreating] = useState(false)
  const [pwFor, setPwFor] = useState<string | null>(null)

  const apply = (result: { ok: boolean; users: User[]; error?: AuthError }, done?: string) => {
    if (!result.ok) { setError(result.error ?? null); return }
    setError(null)
    onChange(result.users)
    if (done) logActivity('doc', done)
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', gap: '8px', padding: '11px 12px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: '16px' }}>
        <ShieldAlert size={16} color="#c2410c" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '11px', color: '#9a3412', lineHeight: 1.45 }}>
          Comptes et mots de passe sont stockés en clair dans ce navigateur. Ils organisent
          l'accès à l'interface ; ils ne protègent pas les données. Une vraie protection
          demandera un serveur (Supabase Auth + RLS).
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#fdecec', border: '1px solid #f5c2c2', color: '#b91c1c', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
          {AUTH_ERROR_LABEL[error]}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {!creating && (
        <button onClick={() => { setCreating(true); setError(null) }} style={{ ...bigBtnInline, width: '100%', background: 'var(--navy)', marginBottom: '18px' }}>
          <UserPlus size={17} /> Créer un compte
        </button>
      )}

      {creating && (
        <CreateForm
          onCancel={() => setCreating(false)}
          onCreate={(username, password, role, displayName) => {
            const r = createUser(users, { username, password, role, displayName })
            if (r.ok) setCreating(false)
            apply(r, `Compte « ${username} » créé (${ROLE_LABEL[role]})`)
          }}
        />
      )}

      <div style={sectionLabel}>Comptes ({users.length})</div>
      {users.length === 0 && <Empty>Aucun compte.</Empty>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {users.map(u => {
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
                    identifiant <code>{u.username}</code>
                  </div>
                </div>
                <span style={{ ...badge, background: admin ? '#ede9fe' : '#eef2f6', color: admin ? '#6d28d9' : '#5b7183' }}>
                  {ROLE_LABEL[u.role]}
                </span>
                {u.disabled && <span style={{ ...badge, background: '#fdecec', color: '#dc2626' }}>Désactivé</span>}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {!isMe && !u.disabled && (
                  <button onClick={() => onImpersonate(u)} style={{ ...ghostBtn, borderColor: '#c7b9f0', color: '#6d28d9' }}>
                    <LogIn size={14} /> Se connecter en tant que
                  </button>
                )}
                <button onClick={() => apply(setRole(users, u.id, admin ? 'user' : 'superadmin'), `Rôle de « ${u.username} » : ${ROLE_LABEL[admin ? 'user' : 'superadmin']}`)}
                  style={ghostBtn}>
                  <Shield size={14} /> {admin ? 'Retirer les droits' : 'Passer super-admin'}
                </button>
                <button onClick={() => { setPwFor(pwFor === u.id ? null : u.id); setError(null) }} style={ghostBtn}>
                  <KeyRound size={14} /> Mot de passe
                </button>
                <button onClick={() => apply(setDisabled(users, u.id, !u.disabled), `Compte « ${u.username} » ${u.disabled ? 'réactivé' : 'désactivé'}`)}
                  style={ghostBtn}>
                  {u.disabled ? <Check size={14} /> : <Ban size={14} />} {u.disabled ? 'Réactiver' : 'Désactiver'}
                </button>
                {!isMe && (
                  <button onClick={() => { if (window.confirm(`Supprimer le compte « ${u.username} » ?`)) apply(deleteUser(users, u.id, currentUser.id), `Compte « ${u.username} » supprimé`) }}
                    style={{ ...ghostBtn, borderColor: '#f5c2c2', color: '#dc2626' }}>
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
              </div>

              {pwFor === u.id && (
                <PasswordForm
                  onCancel={() => setPwFor(null)}
                  onSet={pw => { apply(setPassword(users, u.id, pw), `Mot de passe de « ${u.username} » modifié`); setPwFor(null) }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CreateForm({ onCancel, onCreate }: {
  onCancel: () => void
  onCreate: (username: string, password: string, role: UserRole, displayName: string) => void
}) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')

  return (
    <div style={{ padding: '13px', borderRadius: '11px', border: '1px solid var(--line)', background: '#f8fafc', marginBottom: '18px' }}>
      <div style={sectionLabel}>Nouveau compte</div>
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Identifiant" autoCapitalize="none"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nom affiché (facultatif)"
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
        <button onClick={() => onCreate(username, password, role, displayName)}
          style={{ ...bigBtnInline, background: 'var(--navy)', padding: '10px 15px', fontSize: '13px' }}>
          Créer
        </button>
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
