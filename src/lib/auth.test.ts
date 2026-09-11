import { describe, expect, it } from 'vitest'
import {
  User, authenticate, isSuperadmin, canEditLocked,
  createUser, deleteUser, setRole, setDisabled, setPassword,
} from './auth'

const u = (over: Partial<User> & { id: string; username: string }): User => ({
  password: 'pw', role: 'user', displayName: over.username, createdAt: '', ...over,
})

const base: User[] = [
  u({ id: 'u1', username: 'user', password: 'user' }),
  u({ id: 'u2', username: 'superadmin', password: 'superadmin', role: 'superadmin' }),
]

describe('authenticate', () => {
  it('accepts the right credentials', () => {
    expect(authenticate(base, 'user', 'user')?.id).toBe('u1')
  })
  it('ignores the case of the username but not of the password', () => {
    expect(authenticate(base, 'SuperAdmin', 'superadmin')?.id).toBe('u2')
    expect(authenticate(base, 'user', 'USER')).toBeNull()
  })
  it('rejects a wrong password or an unknown account', () => {
    expect(authenticate(base, 'user', 'nope')).toBeNull()
    expect(authenticate(base, 'ghost', 'pw')).toBeNull()
  })
  it('refuses a disabled account', () => {
    const off = [u({ id: 'u3', username: 'off', password: 'pw', disabled: true })]
    expect(authenticate(off, 'off', 'pw')).toBeNull()
  })
  it('tolerates surrounding spaces in the username', () => {
    expect(authenticate(base, '  user  ', 'user')?.id).toBe('u1')
  })
})

describe('roles', () => {
  it('recognises the super-admin', () => {
    expect(isSuperadmin(base[1])).toBe(true)
    expect(isSuperadmin(base[0])).toBe(false)
    expect(isSuperadmin(null)).toBe(false)
  })
  it('reserves editing a diffused CR to the super-admin', () => {
    expect(canEditLocked(base[1])).toBe(true)
    expect(canEditLocked(base[0])).toBe(false)
  })
})

describe('createUser', () => {
  it('adds an account', () => {
    const r = createUser(base, { username: 'moe', password: 'x', role: 'user' })
    expect(r.ok).toBe(true)
    expect(r.users).toHaveLength(3)
    expect(r.users[2]).toMatchObject({ username: 'moe', role: 'user', displayName: 'moe' })
  })
  it('refuses a duplicate username whatever its case', () => {
    expect(createUser(base, { username: 'USER', password: 'x', role: 'user' }).error).toBe('username_taken')
  })
  it('requires a username and a password', () => {
    expect(createUser(base, { username: '  ', password: 'x', role: 'user' }).error).toBe('username_required')
    expect(createUser(base, { username: 'a', password: '', role: 'user' }).error).toBe('password_required')
  })
})

describe('protecting the last super-admin', () => {
  it('refuses to delete, demote or disable it', () => {
    expect(deleteUser(base, 'u2', 'u1').error).toBe('last_superadmin')
    expect(setRole(base, 'u2', 'user').error).toBe('last_superadmin')
    expect(setDisabled(base, 'u2', true).error).toBe('last_superadmin')
  })
  it('allows it once another super-admin exists', () => {
    const two = [...base, u({ id: 'u3', username: 'admin2', role: 'superadmin' })]
    expect(setRole(two, 'u2', 'user').ok).toBe(true)
    expect(deleteUser(two, 'u2', 'u1').ok).toBe(true)
  })
  it('does not count a disabled super-admin as a backup', () => {
    const two = [...base, u({ id: 'u3', username: 'admin2', role: 'superadmin', disabled: true })]
    expect(deleteUser(two, 'u2', 'u1').error).toBe('last_superadmin')
  })
})

describe('deleteUser', () => {
  it('refuses self-deletion', () => {
    expect(deleteUser(base, 'u1', 'u1').error).toBe('self_delete')
  })
  it('reports an unknown account', () => {
    expect(deleteUser(base, 'ghost', 'u2').error).toBe('not_found')
  })
  it('removes a regular account', () => {
    const r = deleteUser(base, 'u1', 'u2')
    expect(r.ok).toBe(true)
    expect(r.users.map(x => x.id)).toEqual(['u2'])
  })
})

describe('setPassword', () => {
  it('changes it', () => {
    const r = setPassword(base, 'u1', 'neuf')
    expect(authenticate(r.users, 'user', 'neuf')?.id).toBe('u1')
  })
  it('refuses an empty one', () => {
    expect(setPassword(base, 'u1', '').error).toBe('password_required')
  })
})
