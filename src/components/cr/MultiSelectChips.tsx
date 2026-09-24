// Sélecteur multi-entités générique (entreprises / lots / logements du
// Journal CR — sections 7 à 9 du sprint) : recherche, sélection multiple,
// étiquettes/chips. UNE seule implémentation, réutilisée partout où une
// remarque doit pouvoir viser plusieurs destinataires/lots/logements —
// jamais un système de saisie parallèle par contexte.
import { useMemo, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'

export interface ChipOption { id: string; label: string }

interface Props {
  options: ChipOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean // ex. « Toutes les entreprises » cochée : la sélection fine n'a plus de sens
}

export function MultiSelectChips({ options, selected, onChange, placeholder, disabled }: Props) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const labelOf = (id: string) => options.find(o => o.id === id)?.label ?? id
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase()
    const rest = options.filter(o => !selected.includes(o.id))
    return t ? rest.filter(o => o.label.toLowerCase().includes(t)) : rest
  }, [options, selected, term])

  const add = (id: string) => { onChange([...selected, id]); setTerm('') }
  const remove = (id: string) => onChange(selected.filter(x => x !== id))

  return (
    <div style={{ position: 'relative', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', minHeight: 32,
        padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff',
      }}>
        {selected.map(id => (
          <span key={id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
            color: 'var(--navy)', background: '#eef2f6', borderRadius: 999, padding: '3px 8px 3px 10px',
          }}>
            {labelOf(id)}
            <button type="button" onClick={() => remove(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 0 }}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={term}
          onChange={e => { setTerm(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={selected.length === 0 ? (placeholder ?? 'Rechercher…') : ''}
          style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', fontSize: 12, padding: '3px 2px', background: 'transparent' }}
        />
        <ChevronDown size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 3, background: '#fff',
          border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          zIndex: 60, maxHeight: 180, overflowY: 'auto',
        }}>
          {filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(o.id) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink)' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
