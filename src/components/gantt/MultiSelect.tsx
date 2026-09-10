import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface MSOption { id: string; label: string; group?: string }

interface Props {
  label: string
  options: MSOption[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

export function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }

  const count = selected.size
  const summary = count === 0 ? `Tous · ${label}` : `${label} (${count})`

  // group options
  const groups: { name: string | undefined; items: MSOption[] }[] = []
  for (const o of options) {
    let g = groups.find(x => x.name === o.group)
    if (!g) { g = { name: o.group, items: [] }; groups.push(g) }
    g.items.push(o)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`gtb ${count ? 'on' : ''}`} onClick={() => setOpen(o => !o)} style={{ gap: '6px' }}>
        {summary}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: '#fff', border: '1px solid var(--line)', borderRadius: '10px', boxShadow: 'var(--shadow)', padding: '6px', minWidth: '190px', maxHeight: '300px', overflowY: 'auto' }}>
          {count > 0 && (
            <button onClick={() => onChange(new Set())} style={{ width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'none', color: 'var(--accent)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              Tout effacer
            </button>
          )}
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.name && <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, padding: '6px 8px 3px' }}>{g.name}</div>}
              {g.items.map(o => {
                const on = selected.has(o.id)
                return (
                  <button key={o.id} onClick={() => toggle(o.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 8px', border: 'none', background: on ? 'var(--sky-soft)' : 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--ink)', fontWeight: on ? 600 : 400 }}>
                    <span style={{ width: '15px', height: '15px', borderRadius: '4px', border: on ? 'none' : '1.5px solid #cbd6e0', background: on ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {on && <Check size={11} color="#fff" />}
                    </span>
                    {o.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
