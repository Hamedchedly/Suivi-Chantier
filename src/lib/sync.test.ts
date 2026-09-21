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
        // Chaînable ET awaitable directement : les appelants existants font
        // `await select(...).eq('user_id', uid)` (toutes les lignes), tandis
        // que reconcileProjectsBeforeFlush ajoute `.eq('k', ...).maybeSingle()`
        // (une seule clé). Les deux formes doivent marcher sur ce même mock.
        eq: () => {
          const rows = [...server.entries()].map(([k, r]) => ({ k, v: r.v, updated_at: r.updated_at }))
          const base = ctrl.failSelect
            ? { data: null, error: { message: 'offline' } }
            : { data: rows, error: null }
          const chain = Promise.resolve(base) as Promise<typeof base> & {
            eq: (col: string, key: string) => { maybeSingle: () => Promise<{ data: { v: unknown } | null; error: unknown }> }
          }
          chain.eq = (_col: string, key: string) => ({
            maybeSingle: () => Promise.resolve(
              ctrl.failSelect
                ? { data: null, error: { message: 'offline' } }
                : { data: (() => { const found = rows.find(r => r.k === key); return found ? { v: found.v } : null })(), error: null },
            ),
          })
          return chain
        },
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
import { getProjects, findOrphanProjects, restoreOrphanProject } from './repo'

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

  it('POLITIQUE ACTUELLE — deux appareils modifient deux CHAMPS DIFFÉRENTS de la même tâche : pas de fusion par champ, la dernière écriture sur la clé écrase tout (y compris un champ que ce device n’a jamais touché)', async () => {
    // La granularité de synchronisation est la CLÉ localStorage entière (ex.
    // tout le tableau de tâches d’un projet), jamais la tâche ni le champ. Ce
    // test documente le comportement réel — il n’invente aucune nouvelle
    // politique — pour que la limite soit connue plutôt que découverte en
    // production : un « merge » par champ n’existe pas.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'))
    const task = { id: 't1', progress: 50, note: 'initial' }
    srvSet('sc-gantt-v2::p1', [task], '2026-05-01T09:00:00.000Z')

    // Appareil A : lit l’état serveur, modifie l’avancement (progress), flush.
    await initRemoteSession('u1')
    saveState('sc-gantt-v2::p1', [{ ...task, progress: 60 }])
    await vi.advanceTimersByTimeAsync(900)
    expect(server.get('sc-gantt-v2::p1')?.v).toEqual([{ id: 't1', progress: 60, note: 'initial' }])

    // Appareil B : session indépendante partie de l’état ORIGINAL (avant l’édit
    // de A), modifie seulement la note, flush APRÈS A (horodatage plus tardif).
    disableSync()
    localStorage.clear()
    vi.setSystemTime(new Date('2026-05-01T10:05:00.000Z'))
    localStorage.setItem('sc-sync-owner-v1', JSON.stringify('u1')) // même compte, pas de purge
    enableSync('u1')
    saveState('sc-gantt-v2::p1', [{ ...task, note: 'modifiée par B' }]) // progress: 50, jamais vu 60
    await vi.advanceTimersByTimeAsync(900)

    // Le serveur ne contient plus l’avancement 60 de A : B l’a silencieusement
    // écrasé en renvoyant tout le blob tel qu’il l’avait (progress: 50), alors
    // qu’il n’a jamais touché à ce champ.
    expect(server.get('sc-gantt-v2::p1')?.v).toEqual([{ id: 't1', progress: 50, note: 'modifiée par B' }])

    // Appareil A recharge : son avancement à 60 est perdu, sans avertissement.
    disableSync()
    localStorage.clear()
    localStorage.setItem('sc-sync-owner-v1', JSON.stringify('u1'))
    await initRemoteSession('u1')
    expect(loadState('sc-gantt-v2::p1', [])).toEqual([{ id: 't1', progress: 50, note: 'modifiée par B' }])
  })

  it('POLITIQUE ACTUELLE — deux appareils modifient le MÊME champ de la même tâche : dernière écriture gagne intégralement (comportement voulu pour un vrai conflit de valeur)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'))
    srvSet('sc-gantt-v2::p1', [{ id: 't1', progress: 50 }], '2026-05-01T09:00:00.000Z')

    await initRemoteSession('u1')
    saveState('sc-gantt-v2::p1', [{ id: 't1', progress: 60 }]) // appareil A
    await vi.advanceTimersByTimeAsync(900)

    disableSync()
    localStorage.clear()
    vi.setSystemTime(new Date('2026-05-01T10:05:00.000Z'))
    localStorage.setItem('sc-sync-owner-v1', JSON.stringify('u1'))
    enableSync('u1')
    saveState('sc-gantt-v2::p1', [{ id: 't1', progress: 80 }]) // appareil B, plus tardif
    await vi.advanceTimersByTimeAsync(900)

    expect(server.get('sc-gantt-v2::p1')?.v).toEqual([{ id: 't1', progress: 80 }]) // B gagne, pas de fusion 60/80
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

// ── sc-projects-v1 : fusion sûre du registre des opérations ─────────────────
//
// Reproduit et corrige l'incident documenté dans
// docs/AUDIT_ACACIAS_E2E_2026-09-21.md §A : un appareil dont le cache local ne
// connaît qu'un sous-ensemble des opérations du compte ne doit plus jamais
// faire disparaître les autres au premier flush.
describe('sync : registre des projets (sc-projects-v1) — fusion par id', () => {
  const P = (id: string, name = id) => ({ id, name })

  it('TEST 1 — ajouter C à [A, B] donne [A, B, C]', async () => {
    vi.useFakeTimers()
    srvSet('sc-projects-v1', [P('A'), P('B')], '2026-05-01T09:00:00.000Z')
    await initRemoteSession('u1')
    saveState('sc-projects-v1', [P('A'), P('B'), P('C')])
    await vi.advanceTimersByTimeAsync(900)
    expect((server.get('sc-projects-v1')?.v as { id: string }[]).map(p => p.id).sort()).toEqual(['A', 'B', 'C'])
  })

  it('TEST 2 — modifier B dans [A, B, C] donne [A, B_modifié, C]', async () => {
    vi.useFakeTimers()
    srvSet('sc-projects-v1', [P('A'), P('B'), P('C')], '2026-05-01T09:00:00.000Z')
    await initRemoteSession('u1')
    saveState('sc-projects-v1', [P('A'), { id: 'B', name: 'B modifié' }, P('C')])
    await vi.advanceTimersByTimeAsync(900)
    const v = server.get('sc-projects-v1')?.v as { id: string; name: string }[]
    expect(v.find(p => p.id === 'B')?.name).toBe('B modifié')
    expect(v.map(p => p.id).sort()).toEqual(['A', 'B', 'C'])
  })

  it('TEST 3 — supprimer B explicitement (via la corbeille) donne [A, C]', async () => {
    vi.useFakeTimers()
    srvSet('sc-projects-v1', [P('A'), P('B'), P('C')], '2026-05-01T09:00:00.000Z')
    await initRemoteSession('u1')
    // La suppression réelle (App.tsx removeProject) écrit toujours la corbeille
    // ET le nouveau registre — dans cet ordre ou l'autre, peu importe ici.
    saveState('sc-trash-v1', [{ id: 'B', name: 'B', deletedAt: '2026-05-01T10:00:00.000Z' }])
    saveState('sc-projects-v1', [P('A'), P('C')])
    await vi.advanceTimersByTimeAsync(900)
    expect((server.get('sc-projects-v1')?.v as { id: string }[]).map(p => p.id).sort()).toEqual(['A', 'C'])
  })

  it('TEST 4 — un appareil parti de [A, B] ne doit jamais faire perdre C déjà connu du serveur', async () => {
    vi.useFakeTimers()
    // Le serveur a déjà avancé à [A, B, C] (un autre appareil a ajouté C).
    srvSet('sc-projects-v1', [P('A'), P('B'), P('C')], '2026-05-01T09:00:00.000Z')
    // Cet appareil-ci a un cache local plus ancien/incomplet : [A, B] seulement,
    // et son horodatage local est ANTÉRIEUR à celui du serveur pour cette clé
    // → initRemoteSession ne le pousse donc pas lui-même (ce n'est pas le
    // scénario testé ici) ; on simule directement un flush de ce cache via
    // enableSync, le cas réel étant une hydratation incomplète (nouveau profil
    // navigateur, page rechargée avant la fin du fetch serveur).
    localStorage.setItem('sc-sync-owner-v1', JSON.stringify('u1'))
    enableSync('u1')
    saveState('sc-projects-v1', [P('A'), P('B')]) // ignore C, ne sait pas qu'il existe
    await vi.advanceTimersByTimeAsync(900)
    const v = server.get('sc-projects-v1')?.v as { id: string }[]
    expect(v.map(p => p.id).sort()).toEqual(['A', 'B', 'C']) // C préservé, pas perdu
  })

  it('TEST 5 — modifier A sur un appareil ne fait jamais disparaître B ajouté ailleurs entre-temps', async () => {
    vi.useFakeTimers()
    srvSet('sc-projects-v1', [P('A')], '2026-05-01T09:00:00.000Z')
    localStorage.setItem('sc-sync-owner-v1', JSON.stringify('u1'))
    enableSync('u1')
    // Ce device ne connaît que A (édité), mais B a été ajouté côté serveur
    // par un autre appareil juste avant ce flush.
    srvSet('sc-projects-v1', [P('A'), P('B')], '2026-05-01T09:05:00.000Z')
    saveState('sc-projects-v1', [{ id: 'A', name: 'A modifié' }])
    await vi.advanceTimersByTimeAsync(900)
    const v = server.get('sc-projects-v1')?.v as { id: string; name: string }[]
    expect(v.map(p => p.id).sort()).toEqual(['A', 'B'])
    expect(v.find(p => p.id === 'A')?.name).toBe('A modifié')
  })

  it('TEST 6 — les données cloisonnées d’un projet ne sont jamais supprimées par sa simple disparition d’une copie locale de sc-projects-v1', async () => {
    vi.useFakeTimers()
    srvSet('sc-projects-v1', [P('A'), P('B')], '2026-05-01T09:00:00.000Z')
    srvSet('sc-units-v1::B', [{ id: 'u1' }], '2026-05-01T09:00:00.000Z')
    srvSet('sc-gantt-v2::B', [{ id: 't1' }], '2026-05-01T09:00:00.000Z')
    srvSet('sc-visits-v3::B', [{ id: 'v1' }], '2026-05-01T09:00:00.000Z')
    localStorage.setItem('sc-sync-owner-v1', JSON.stringify('u1'))
    enableSync('u1')
    // Ce flush ne touche QUE sc-projects-v1 (B en disparaît localement, sans
    // corbeille) — aucune des clés cloisonnées de B n'est jamais écrite ni
    // supprimée par ce mécanisme : il n'agit que sur la clé qu'on lui donne.
    saveState('sc-projects-v1', [P('A')])
    await vi.advanceTimersByTimeAsync(900)
    // B reste dans le registre fusionné (comme TEST 4)…
    expect((server.get('sc-projects-v1')?.v as { id: string }[]).map(p => p.id).sort()).toEqual(['A', 'B'])
    // …et ses données cloisonnées n'ont jamais été touchées.
    expect(server.get('sc-units-v1::B')?.v).toEqual([{ id: 'u1' }])
    expect(server.get('sc-gantt-v2::B')?.v).toEqual([{ id: 't1' }])
    expect(server.get('sc-visits-v3::B')?.v).toEqual([{ id: 'v1' }])
  })

  it('TEST E — restaurer un projet orphelin le rend visible dans le registre, avec le même id, sans créer de donnée métier', async () => {
    vi.useFakeTimers()
    // Le serveur ne connaît plus que Acacias dans le registre, mais les
    // données métier de Gambetta existent toujours sous leurs clés cloisonnées
    // (incident réel — voir docs/SPRINT_FIABILISATION_2026-09-21.md §5).
    srvSet('sc-projects-v1', [P('acacias', 'Acacias')], '2026-09-01T09:00:00.000Z')
    srvSet('sc-lots-config-v1::gambetta', [{ id: 'LOT01', company: 'LERICHE' }], '2026-09-01T09:00:00.000Z')
    await initRemoteSession('u1')

    expect(findOrphanProjects()).toEqual(['gambetta']) // détecté avant toute écriture

    const r = restoreOrphanProject({
      id: 'gambetta', name: '111 rue Gambetta', reference: 'ER.T2286',
      address: '111 Rue Gambetta, 51100 Reims', createdAt: '2026-09-17T21:31:17.590Z',
    })
    expect(r.ok).toBe(true)
    await vi.advanceTimersByTimeAsync(900)

    const v = server.get('sc-projects-v1')?.v as { id: string; name: string }[]
    expect(v.map(p => p.id).sort()).toEqual(['acacias', 'gambetta']) // même id, aucun nouvel id
    expect(v.find(p => p.id === 'gambetta')?.name).toBe('111 rue Gambetta')
    expect(getProjects().find(p => p.id === 'gambetta')?.id).toBe('gambetta') // visible localement
    // Les données métier cloisonnées n'ont pas bougé — cette fonction ne les touche jamais.
    expect(server.get('sc-lots-config-v1::gambetta')?.v).toEqual([{ id: 'LOT01', company: 'LERICHE' }])
  })

  it('TEST F — après restauration, un flush ultérieur du registre ne fait disparaître aucun projet restauré (régression)', async () => {
    vi.useFakeTimers()
    srvSet('sc-projects-v1', [P('acacias', 'Acacias')], '2026-09-01T09:00:00.000Z')
    srvSet('sc-lots-config-v1::gambetta', [{ id: 'LOT01' }], '2026-09-01T09:00:00.000Z')
    await initRemoteSession('u1')
    restoreOrphanProject({ id: 'gambetta', name: '111 rue Gambetta', createdAt: '2026-09-17T21:31:17.590Z' })
    await vi.advanceTimersByTimeAsync(900)
    expect((server.get('sc-projects-v1')?.v as { id: string }[]).map(p => p.id).sort()).toEqual(['acacias', 'gambetta'])

    // Un flush ultérieur et sans rapport avec la restauration (création d'une
    // nouvelle opération C, à partir du cache local qui connaît déjà gambetta).
    saveState('sc-projects-v1', [...getProjects(), { id: 'C', name: 'Nouvelle opération', createdAt: '2026-09-21T00:00:00.000Z' }])
    await vi.advanceTimersByTimeAsync(900)
    const ids = (server.get('sc-projects-v1')?.v as { id: string }[]).map(p => p.id).sort()
    expect(ids).toEqual(['C', 'acacias', 'gambetta']) // gambetta toujours là
  })

  it('reproduit l’incident réel : un profil navigateur neuf qui ne crée qu’Acacias ne doit plus écraser Gambetta/Tilleuls/TEST', async () => {
    vi.useFakeTimers()
    srvSet('sc-projects-v1', [P('gambetta', 'Gambetta'), P('tilleuls', 'Les Tilleuls'), P('test', 'TEST')], '2026-09-01T09:00:00.000Z')
    // Profil navigateur neuf : jamais hydraté, sc-sync-owner-v1 absent.
    enableSync('u1')
    saveState('sc-projects-v1', [P('acacias', 'Résidence des Acacias')])
    await vi.advanceTimersByTimeAsync(900)
    const ids = (server.get('sc-projects-v1')?.v as { id: string }[]).map(p => p.id).sort()
    expect(ids).toEqual(['acacias', 'gambetta', 'test', 'tilleuls'])
  })
})
