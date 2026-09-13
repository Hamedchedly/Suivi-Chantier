// Lightweight localStorage helpers with Date serialization support.
// Dates are encoded as { __date: ISOString } so they survive JSON round-trips.

const DATE_KEY = '__date'

// Note: JSON.stringify calls Date.prototype.toJSON() before the replacer runs,
// so `value` is already an ISO string here. We read the original object via
// `this[key]` to detect real Date instances.
function replacer(this: Record<string, unknown>, key: string, value: unknown) {
  const original = this[key]
  if (original instanceof Date) return { [DATE_KEY]: original.toISOString() }
  return value
}

function reviver(_key: string, value: unknown) {
  if (value && typeof value === 'object' && DATE_KEY in (value as Record<string, unknown>)) {
    return new Date((value as Record<string, string>)[DATE_KEY])
  }
  return value
}

/** Date-aware JSON serialize/deserialize (reused for URL share snapshots). */
export function serialize<T>(value: T): string {
  return JSON.stringify(value, replacer)
}

export function deserialize<T>(raw: string): T {
  return JSON.parse(raw, reviver) as T
}

export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw, reviver) as T
  } catch {
    return fallback
  }
}

// ── Notificateurs de mutation ────────────────────────────────────────────────
// Permettent à une couche de synchronisation (src/lib/sync.ts) d'observer les
// écritures/suppressions sans que les appelants (repo.ts, composants) changent.
// `raw` est la chaîne déjà sérialisée (dates encodées) — prête à être renvoyée.
type WriteListener = (key: string, raw: string) => void
type RemoveListener = (key: string) => void
const writeListeners = new Set<WriteListener>()
const removeListeners = new Set<RemoveListener>()

export function onStateWrite(fn: WriteListener): () => void {
  writeListeners.add(fn)
  return () => { writeListeners.delete(fn) }
}

export function onStateRemove(fn: RemoveListener): () => void {
  removeListeners.add(fn)
  return () => { removeListeners.delete(fn) }
}

export function saveState<T>(key: string, value: T): void {
  let raw: string
  try {
    raw = JSON.stringify(value, replacer)
  } catch {
    return // valeur non sérialisable — on abandonne
  }
  try {
    localStorage.setItem(key, raw)
  } catch {
    // storage plein ou indisponible — on notifie tout de même le miroir serveur
  }
  for (const fn of writeListeners) fn(key, raw)
}

export function removeState(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // indisponible — ignore
  }
  for (const fn of removeListeners) fn(key)
}
