// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Serveur simulé : une Map k → v tient lieu de table app_state.
// ctrl.failWrites force l'échec des upserts (test du backoff / re-file).
const { server, ctrl } = vi.hoisted(() => ({
  server: new Map<string, unknown>(),
  ctrl: { failWrites: false },
}))

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({
          data: [...server.entries()].map(([k, v]) => ({ k, v })),
          error: null,
        }),
      }),
      upsert: (rows: { k: string; v: unknown }[]) => {
        if (ctrl.failWrites) return Promise.resolve({ error: { message: 'boom' } })
        for (const r of rows) server.set(r.k, r.v)
        return Promise.resolve({ error: null })
      },
      delete: () => ({
        eq: () => ({
          in: (_col: string, keys: string[]) => {
            for (const k of keys) server.delete(k)
            return Promise.resolve({ error: null })
          },
        }),
      }),
    }),
  },
}))

import { hydrateFromRemote, enableSync, disableSync, clearLocalAppState } from './sync'
import { saveState, loadState, removeState } from './storage'

beforeEach(() => {
  server.clear()
  localStorage.clear()
  ctrl.failWrites = false
  disableSync()
})
afterEach(() => { vi.useRealTimers() })

describe('sync : hydratation', () => {
  it('recopie l’état serveur dans localStorage en ravivant les dates', async () => {
    server.set('sc-gantt-v2::p1', [{ id: 't1', planned_start: { __date: '2026-01-02T00:00:00.000Z' } }])
    const n = await hydrateFromRemote('u1')
    expect(n).toBe(1)
    const tasks = loadState<Array<{ planned_start: Date }>>('sc-gantt-v2::p1', [])
    expect(tasks[0].planned_start instanceof Date).toBe(true)
    expect(tasks[0].planned_start.toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })

  it('purge le cache applicatif local, en épargnant les clés d’auth', () => {
    localStorage.setItem('sc-reserves-v1::p1', '[{"old":true}]')
    localStorage.setItem('sc-session-v1', '{"userId":"u"}')
    localStorage.setItem('autre-cle', 'x')
    clearLocalAppState()
    expect(localStorage.getItem('sc-reserves-v1::p1')).toBeNull()
    expect(localStorage.getItem('sc-session-v1')).not.toBeNull() // auth préservée
    expect(localStorage.getItem('autre-cle')).not.toBeNull()     // hors périmètre
  })
})

describe('sync : write-through', () => {
  it('répercute saveState en upsert serveur, après débounce', async () => {
    vi.useFakeTimers()
    enableSync('u1')
    saveState('sc-reserves-v1::p1', [{ id: 'r1' }])
    expect(server.has('sc-reserves-v1::p1')).toBe(false) // pas encore flushé
    await vi.advanceTimersByTimeAsync(900)
    expect(server.get('sc-reserves-v1::p1')).toEqual([{ id: 'r1' }])
  })

  it('encode les dates dans le miroir serveur (round-trip hydratation)', async () => {
    vi.useFakeTimers()
    enableSync('u1')
    saveState('sc-holidays-v1::p1', [{ start: new Date('2026-08-01T00:00:00.000Z') }])
    await vi.advanceTimersByTimeAsync(900)
    vi.useRealTimers()
    localStorage.clear()
    await hydrateFromRemote('u1')
    const h = loadState<Array<{ start: Date }>>('sc-holidays-v1::p1', [])
    expect(h[0].start.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('répercute removeState en delete serveur', async () => {
    vi.useFakeTimers()
    server.set('sc-reserves-v1::p1', [{ id: 'r1' }])
    enableSync('u1')
    removeState('sc-reserves-v1::p1')
    await vi.advanceTimersByTimeAsync(900)
    expect(server.has('sc-reserves-v1::p1')).toBe(false)
  })

  it('n’envoie jamais les clés gérées par Supabase Auth', async () => {
    vi.useFakeTimers()
    enableSync('u1')
    saveState('sc-users-v1', [{ id: 'u' }])
    saveState('sc-session-v1', { userId: 'u' })
    await vi.advanceTimersByTimeAsync(900)
    expect(server.size).toBe(0)
  })

  it('n’écrit rien tant que la sync n’est pas activée', async () => {
    vi.useFakeTimers()
    saveState('sc-reserves-v1::p1', [{ id: 'r1' }])
    await vi.advanceTimersByTimeAsync(900)
    expect(server.size).toBe(0)
  })

  it('cesse d’écrire après disableSync', async () => {
    vi.useFakeTimers()
    enableSync('u1')
    disableSync()
    saveState('sc-reserves-v1::p1', [{ id: 'r1' }])
    await vi.advanceTimersByTimeAsync(900)
    expect(server.size).toBe(0)
  })

  it('synchronise une valeur null (ex. plus d’opération active)', async () => {
    vi.useFakeTimers()
    enableSync('u1')
    saveState('sc-current-project-v1', null)
    await vi.advanceTimersByTimeAsync(900)
    expect(server.has('sc-current-project-v1')).toBe(true)
    expect(server.get('sc-current-project-v1')).toBeNull()
  })

  it('conserve la donnée et réessaie après un échec réseau (backoff)', async () => {
    vi.useFakeTimers()
    enableSync('u1')
    ctrl.failWrites = true
    saveState('sc-reserves-v1::p1', [{ id: 'r1' }])
    await vi.advanceTimersByTimeAsync(900)
    expect(server.size).toBe(0) // échec → rien côté serveur, mais pas perdu
    ctrl.failWrites = false
    await vi.advanceTimersByTimeAsync(5_000) // la tentative suivante (backoff) passe
    expect(server.get('sc-reserves-v1::p1')).toEqual([{ id: 'r1' }])
  })
})
