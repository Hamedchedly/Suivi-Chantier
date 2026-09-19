// Liste de prédécesseurs, simplifiée : le nom du lot/tâche + son type de
// liaison. Pas de lignes de connexion dessinées sur le Gantt — juste ce
// panneau, comme demandé (section 19 : « rendre l'interface beaucoup plus
// simple »).
import { X } from 'lucide-react'
import { PlanningDependency, PlanningDependencyType } from '../../../types/planning'

const TYPE_LABEL: Record<PlanningDependencyType, string> = {
  finish_to_start: 'FS',
  start_to_start: 'SS',
  finish_to_finish: 'FF',
  start_to_finish: 'SF',
}

interface Props {
  dependency: PlanningDependency
  title: string
  onRemove?: () => void
}

export function GanttDependency({ dependency, title, onRemove }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', background: '#eef2f6', borderRadius: 10, padding: '2px 8px' }}>
          {TYPE_LABEL[dependency.type]}
        </span>
        {onRemove && (
          <button onClick={onRemove} aria-label="Retirer la dépendance" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
