// En-tête temporel : sélecteur de zoom (jour/semaine/mois/trimestre) + grille
// de dates. Le zoom ne change que l'échelle des colonnes, jamais les dates.
//
// Scindé en deux : la colonne « Lot / Tâche » (son propre volet, scroll
// vertical uniquement) et la grille de dates (volet qui scrolle aussi à
// l'horizontale). Les deux volets sont synchronisés verticalement par
// l'orchestrateur (Gantt.tsx) — un seul bloc avec `position: sticky` ne
// suffit pas à garder la colonne en place pendant le scroll horizontal.
import { TimelineScale, ZoomLevel, ZOOM_LEVELS, ZOOM_LABEL, headerCells, timelineWidth, monthBands, weekNumbers } from '../../../lib/planningViewModel'

export const HEADER_HEIGHT = 34
export const MONTH_BAND_HEIGHT = 18
export const WEEK_NUMBER_HEIGHT = 16

/** Hauteur totale de l'en-tête : en vue semaine, 3 lignes empilées (mois /
 * semaine / n° de semaine) — mois/trimestre restent une seule ligne, comme
 * avant, ils n'ont ni bandeau mois ni numéro de semaine. */
export function headerHeightFor(zoom: ZoomLevel): number {
  return zoom === 'week' ? MONTH_BAND_HEIGHT + HEADER_HEIGHT + WEEK_NUMBER_HEIGHT : HEADER_HEIGHT
}

interface LabelProps {
  zoom: ZoomLevel
  onZoomChange: (z: ZoomLevel) => void
}

export function GanttHeaderLabel({ zoom, onZoomChange }: LabelProps) {
  return (
    <div style={{
      height: headerHeightFor(zoom), display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 10px', borderBottom: '2px solid var(--navy)', gap: 4, background: '#fff',
      position: 'sticky', top: 0, zIndex: 2,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Lot / Tâche</span>
      <div style={{ display: 'flex', gap: 2 }}>
        {ZOOM_LEVELS.map(z => (
          <button
            key={z}
            onClick={() => onZoomChange(z)}
            title={ZOOM_LABEL[z]}
            style={{
              fontSize: 10, fontWeight: 700, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--line)',
              background: z === zoom ? 'var(--navy)' : '#fff', color: z === zoom ? '#fff' : 'var(--muted)', cursor: 'pointer',
            }}
          >
            {ZOOM_LABEL[z].slice(0, 1)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function GanttHeaderTimeline({ scale }: { scale: TimelineScale; today: Date }) {
  const cells = headerCells(scale)
  const isWeek = scale.zoom === 'week'
  const bands = isWeek ? monthBands(scale) : []
  const numbers = isWeek ? weekNumbers(scale) : []
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '2px solid var(--navy)', width: timelineWidth(scale), height: headerHeightFor(scale.zoom) }}>
      {/* Bandeau mois — vue semaine uniquement : une cellule fusionnée par mois,
          4-5 colonnes semaine selon son nombre de lundis (format du planning de
          référence). */}
      {bands.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: b.x, width: b.width, top: 0, height: MONTH_BAND_HEIGHT,
            borderLeft: '1px solid var(--line)', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: 'var(--navy)', textTransform: 'capitalize',
            background: '#f8fafc',
          }}
        >
          {b.label}
        </div>
      ))}
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: c.x, width: c.width, top: isWeek ? MONTH_BAND_HEIGHT : 0, height: HEADER_HEIGHT,
            borderLeft: '1px solid var(--line)',
            background: c.isWeekend ? '#f8fafc' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: 'var(--muted)', boxSizing: 'border-box',
          }}
        >
          {c.label}
        </div>
      ))}
      {/* N° de semaine depuis le début réel du chantier — vue semaine uniquement. */}
      {numbers.map((n, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: n.x, width: n.width, top: MONTH_BAND_HEIGHT + HEADER_HEIGHT, height: WEEK_NUMBER_HEIGHT,
            borderLeft: '1px solid var(--line)', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 600, color: 'var(--muted)', background: '#fbfcfe',
          }}
        >
          S{n.label}
        </div>
      ))}
    </div>
  )
}
