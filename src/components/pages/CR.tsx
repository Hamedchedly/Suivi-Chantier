import { CrTable } from './CrTable'
import { Breadcrumbs, buildCrBreadcrumbs } from '../layout/Breadcrumbs'

// Sprint Journal CR (sections 5-6) : plus d'onglets Journal CR / Réunions /
// Notes & suivi — UN SEUL journal, alimenté par les réunions (vue « Par
// réunion » dans CrTable) et les notes de suivi (déjà le même objet Reserve).
export function CR() {
  const breadcrumbs = buildCrBreadcrumbs('journal')
  return (
    <div>
      <div style={{ padding: '12px 12px 0' }}>
        <Breadcrumbs crumbs={breadcrumbs} />
      </div>
      <CrTable />
    </div>
  )
}
