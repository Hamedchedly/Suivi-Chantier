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

export function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value, replacer))
  } catch {
    // storage full or unavailable — ignore
  }
}
