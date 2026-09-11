import { CheckSquare, Square, Trash2, X } from 'lucide-react'
import { Selection, allSelected, selectionLabel } from '../../lib/selection'

interface Props {
  /** Mode sélection actif : la barre n'apparaît qu'alors. */
  active: boolean
  selection: Selection
  /** Identifiants actuellement visibles (filtres appliqués). */
  visibleIds: string[]
  /** Nom de l'objet au singulier, pour l'accord du libellé. */
  noun: string
  feminine?: boolean
  onToggleAll: () => void
  onDelete: () => void
  onCancel: () => void
}

/**
 * Barre d'actions du mode sélection : tout cocher, supprimer, quitter.
 * La suppression est confirmée par le parent (elle est irréversible).
 */
export function SelectionBar({
  active, selection, visibleIds, noun, feminine, onToggleAll, onDelete, onCancel,
}: Props) {
  if (!active) return null
  const count = visibleIds.filter(id => selection.has(id)).length
  const every = allSelected(selection, visibleIds)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      padding: '9px 11px', marginBottom: '10px', borderRadius: '10px',
      background: 'var(--sky-soft)', border: '1px solid var(--line)',
    }}>
      <button onClick={onToggleAll} style={linkBtn} title={every ? 'Tout décocher' : 'Tout cocher'}>
        {every ? <CheckSquare size={15} /> : <Square size={15} />}
        {every ? 'Tout décocher' : 'Tout cocher'}
      </button>

      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--navy)', minWidth: '110px' }}>
        {selectionLabel(count, noun, feminine)}
      </span>

      <button
        onClick={onDelete}
        disabled={count === 0}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
          borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 700,
          background: count === 0 ? '#e8eef4' : '#b42318',
          color: count === 0 ? 'var(--muted)' : '#fff',
          cursor: count === 0 ? 'default' : 'pointer',
        }}
      >
        <Trash2 size={14} /> Supprimer
      </button>

      <button onClick={onCancel} style={linkBtn} title="Quitter la sélection">
        <X size={15} /> Annuler
      </button>
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '5px', border: 'none', background: 'none',
  color: 'var(--navy)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 2px',
}
