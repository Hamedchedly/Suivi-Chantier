// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Serveur simulé : Map k → { v, updated_at } tient lieu de table app_state.
// ctrl.failWrites force l'échec des upserts (test du backoff / re-file).
// ctrl.failSelect force l'échec de la lecture (test du mode hors-ligne).
const { server, ctrl } = vi.hoisted(() => ({
  server: new Map<string, { v: unknown; updated_at: string }>(),
  ctrl: { failWrites: false, failSelect: false },
}))

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(
          ctrl.failSelect
            ? { data: null, error: { message: 'offline' } }
            : {
                data: [...server.entries()].map(([k, r]) => ({ k, v: r.v, updated_at: r.updated_at })),
                error: null,
              },
        ),
      }),
      upsert: (rows: { k: string; v: unknown; updated_at?: string }[]) => {
        if (ctrl.failWrites) return Promise.resolve({ error: { message: 'boom' } })
        for (const r of rows) server.set(r.k, { v: r.v, updated_at: r.updated_at ?? new Date().toISOString() })
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

import {
  hydrateFromRemote, enableSync, disableSync, clearLocalAppState, initRemoteSession,
} from './sync'
import { saveState, loadState, removeState } from './storage'

/** Écrit une valeur "serveur" avec un horodatage donné. */
function srvSet(k: string, v: unknown, updated_at: string) {
  server.set(k, { v, updated_at })
}

beforeEach(() => {
  server.clear()
  localStorage.clear()
  ctrl.failWrites = false
  ctrl.failSelect = false
  disableSync()
})
afterEach(() => { vi.useRealTimers() })

describe('sync : hydratation brute', () => {
  it('recopie l’état serveur dans localStorage en ravivant les dates', async () => {
    srvSet('sc-gantt-v2::p1', [{ id: 't1', planned_start: { __date: '2026-01-02T00:00:00.000Z' } }], 's1')
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
    expect(server.get('sc-reserves-v1::p1')?.v).toEqual([{ id: 'r1' }])
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
    srvSet('sc-reserves-v1::p1', [{ id: 'r1' }], 's1')
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
    expect(server.get('sc-current-project-v1')?.v).toBeNull()
  })

  it('conserve la donnée et réessaie après un échec réseau (backoff)', async () => {
    vi.useFakeTimers()
    enableSync('u1')
    ctrl.failWrites = true
    saveState('sc-reserves-v1::p1', [{ id: 'r1' }])
    await vi.advanceTimersByTimeAsync(900)
    expect(server.size).toBe(0) // échec → rien côté serveur, mais pas perdu
    ctrl.failWrites = false
    await vi.advanceTimersByTimeAsync(5_000) // tentative suivante (backoff) passe
    expect(server.get('sc-reserves-v1::p1')?.v).toEqual([{ id: 'r1' }])
  })
})

describe('sync : session (fusion dernière-écriture-gagne)', () => {
  it('nouveau compte sur ce navigateur → purge puis hydrate le serveur', async () => {
    localStorage.setItem('sc-reserves-v1::pX', '[{"old":true}]') // reste d'un autre compte
    srvSet('sc-gantt-v2::p1', [{ id: 't1' }], 's1')
    await initRemoteSession('u1')
    expect(localStorage.getItem('sc-reserves-v1::pX')).toBeNull() // purgé
    expect(loadState('sc-gantt-v2::p1', [])).toEqual([{ id: 't1' }])
  })

  it('rechargement hors-ligne : conserve le cache local intact', async () => {
    // Première session en ligne pour poser le propriétaire du cache.
    srvSet('sc-gantt-v2::p1', [{ id: 't1' }], 's1')
    await initRemoteSession('u1')
    // Hors-ligne au rechargement suivant : la lecture échoue.
    ctrl.failSelect = true
    await initRemoteSession('u1')
    expect(loadState('sc-gantt-v2::p1', [])).toEqual([{ id: 't1' }]) // pas vidé
  })

  it('une édition locale plus récente n’est pas écrasée et est repoussée', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'))
    // Session initiale : le serveur a une ancienne valeur.
    srvSet('sc-reserves-v1::p1', [{ id: 'old' }], '2026-05-01T09:00:00.000Z')
    await initRemoteSession('u1')
    // Édition locale (write-through) → horodatage local plus récent.
    saveState('sc-reserves-v1::p1', [{ id: 'new' }])
    await vi.advanceTimersByTimeAsync(900)
    // Le serveur reflète la valeur locale récente.
    expect(server.get('sc-reserves-v1::p1')?.v).toEqual([{ id: 'new' }])
    // Le serveur "revient" avec une valeur plus ANCIENNE : elle ne doit pas gagner.
    srvSet('sc-reserves-v1::p1', [{ id: 'old' }], '2026-05-01T09:30:00.000Z')
    await initRemoteSession('u1')
    expect(loadState('sc-reserves-v1::p1', [])).toEqual([{ id: 'new' }])
  })

  it('une clé locale absente du serveur (créée hors-ligne) est poussée', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'))
    // Propriétaire posé, serveur vide au départ.
    await initRemoteSession('u1')
    // Édition locale d'une clé, puis "coupure" : on simule via failSelect au retour.
    saveState('sc-reserves-v1::p1', [{ id: 'local' }])
    await vi.advanceTimersByTimeAsync(900)
    expect(server.get('sc-reserves-v1::p1')?.v).toEqual([{ id: 'local' }])
  })

  it('une modification faite sur un AUTRE appareil (serveur plus récent) écrase le cache local — vrai conflit multi-appareils', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'))
    // Cet appareil édite en premier : sa valeur devient la plus récente connue localement.
    srvSet('sc-reserves-v1::p1', [{ id: 'from-device-A' }], '2026-05-01T09:00:00.000Z')
    await initRemoteSession('u1')
    saveState('sc-reserves-v1::p1', [{ id: 'from-device-A' }])
    await vi.advanceTimersByTimeAsync(900)

    // Un AUTRE appareil édite ensuite la même clé, plus tard, directement sur le serveur.
    srvSet('sc-reserves-v1::p1', [{ id: 'from-device-B' }], '2026-05-01T11:00:00.000Z')
    // Cet appareil recharge : il doit récupérer la version du device B, pas garder la sienne.
    await initRemoteSession('u1')
    expect(loadState('sc-reserves-v1::p1', [])).toEqual([{ id: 'from-device-B' }])
  })
})
