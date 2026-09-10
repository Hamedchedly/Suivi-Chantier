// Activity log — chronological trace of project events (prototype: localStorage).

export type ActivityType = 'visit' | 'reserve' | 'resolve' | 'finance' | 'planning' | 'alert' | 'doc'

export interface ActivityEvent {
  id: string
  at: string          // ISO timestamp
  type: ActivityType
  message: string
}

export const ACTIVITY_MAX = 200

/** Prepend a new event, keeping at most ACTIVITY_MAX. */
export function pushEvent(events: ActivityEvent[], type: ActivityType, message: string, now = new Date()): ActivityEvent[] {
  const ev: ActivityEvent = { id: `a${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`, at: now.toISOString(), type, message }
  return [ev, ...events].slice(0, ACTIVITY_MAX)
}

/** Human relative time (French). */
export function relativeTime(at: string, now = new Date()): string {
  const diff = now.getTime() - new Date(at).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'hier'
  if (d < 7) return `il y a ${d} j`
  return new Date(at).toLocaleDateString('fr')
}

/** Group events by calendar day (most recent first), preserving order within a day. */
export function groupByDay(events: ActivityEvent[]): { day: string; label: string; events: ActivityEvent[] }[] {
  const out: { day: string; label: string; events: ActivityEvent[] }[] = []
  for (const e of events) {
    const day = e.at.slice(0, 10)
    let g = out.find(x => x.day === day)
    if (!g) { g = { day, label: new Date(e.at).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long' }), events: [] }; out.push(g) }
    g.events.push(e)
  }
  return out
}
