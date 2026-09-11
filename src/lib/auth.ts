// ────────────────────────────────────────────────────────────────────────────
// Accounts and session (prototype).
//
// ⚠ This is an ACCESS CONTROL FOR THE INTERFACE, NOT A SECURITY BOUNDARY.
// Everything runs in the browser: the accounts, their passwords and the current
// session all live in localStorage, so anyone with the devtools open can read
// them or grant themselves any role. It exists to shape what each profile sees
// and to exercise the super-admin flows before a real backend is wired.
//
// Real enforcement needs the server: Supabase Auth issues the session and RLS
// decides what each role may read or write. Until then, treat these passwords
// as demo credentials and never put anything confidential behind them.
// ────────────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'superadmin'

export const ROLE_LABEL: Record<UserRole, string> = {
  user: 'Utilisateur',
  superadmin: 'Super-administrateur',
}

export interface User {
  id: string
  username: string
  password: string      // plain text — see the note above
  role: UserRole
  displayName: string
  createdAt: string     // ISO
  disabled?: boolean
}

export interface Session {
  userId: string
  /** Set while a super-admin is using the app as someone else. */
  impersonatorId?: string
  at: string            // ISO
}

export function isSuperadmin(u: User | null | undefined): boolean {
  return u?.role === 'superadmin'
}

/** Only a super-admin may reopen a diffused CR. */
export function canEditLocked(u: User | null | undefined): boolean {
  return isSuperadmin(u)
}

export function findUser(users: User[], id: string): User | undefined {
  return users.find(u => u.id === id)
}

/** Usernames are matched case-insensitively; a disabled account cannot sign in. */
export function authenticate(users: User[], username: string, password: string): User | null {
  const u = users.find(x => x.username.toLowerCase() === username.trim().toLowerCase())
  if (!u || u.disabled || u.password !== password) return null
  return u
}

// ── Account management ───────────────────────────────────────────────────────

export type AuthError =
  | 'username_required' | 'password_required' | 'username_taken'
  | 'last_superadmin' | 'self_delete' | 'not_found'

export interface Result<T> {
  ok: boolean
  users: T
  error?: AuthError
}

const superadmins = (users: User[]) => users.filter(u => u.role === 'superadmin' && !u.disabled)

export function createUser(users: User[], input: { username: string; password: string; role: UserRole; displayName?: string }): Result<User[]> {
  const username = input.username.trim()
  if (!username) return { ok: false, users, error: 'username_required' }
  if (!input.password) return { ok: false, users, error: 'password_required' }
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, users, error: 'username_taken' }
  }
  const user: User = {
    id: `u${Date.now()}${Math.floor(Math.random() * 1000)}`,
    username,
    password: input.password,
    role: input.role,
    displayName: input.displayName?.trim() || username,
    createdAt: new Date().toISOString(),
  }
  return { ok: true, users: [...users, user] }
}

/** Never let the last active super-admin be deleted, demoted or disabled. */
function wouldStrandAccount(users: User[], id: string): boolean {
  const target = findUser(users, id)
  if (!target || target.role !== 'superadmin' || target.disabled) return false
  return superadmins(users).length <= 1
}

export function deleteUser(users: User[], id: string, currentUserId: string): Result<User[]> {
  if (!findUser(users, id)) return { ok: false, users, error: 'not_found' }
  if (id === currentUserId) return { ok: false, users, error: 'self_delete' }
  if (wouldStrandAccount(users, id)) return { ok: false, users, error: 'last_superadmin' }
  return { ok: true, users: users.filter(u => u.id !== id) }
}

export function setRole(users: User[], id: string, role: UserRole): Result<User[]> {
  if (!findUser(users, id)) return { ok: false, users, error: 'not_found' }
  if (role !== 'superadmin' && wouldStrandAccount(users, id)) return { ok: false, users, error: 'last_superadmin' }
  return { ok: true, users: users.map(u => u.id === id ? { ...u, role } : u) }
}

export function setDisabled(users: User[], id: string, disabled: boolean): Result<User[]> {
  if (!findUser(users, id)) return { ok: false, users, error: 'not_found' }
  if (disabled && wouldStrandAccount(users, id)) return { ok: false, users, error: 'last_superadmin' }
  return { ok: true, users: users.map(u => u.id === id ? { ...u, disabled } : u) }
}

export function setPassword(users: User[], id: string, password: string): Result<User[]> {
  if (!findUser(users, id)) return { ok: false, users, error: 'not_found' }
  if (!password) return { ok: false, users, error: 'password_required' }
  return { ok: true, users: users.map(u => u.id === id ? { ...u, password } : u) }
}

export const AUTH_ERROR_LABEL: Record<AuthError, string> = {
  username_required: "L'identifiant est obligatoire.",
  password_required: 'Le mot de passe est obligatoire.',
  username_taken: 'Cet identifiant est déjà utilisé.',
  last_superadmin: 'Impossible : ce compte est le dernier super-administrateur actif.',
  self_delete: 'Vous ne pouvez pas supprimer votre propre compte.',
  not_found: 'Compte introuvable.',
}
