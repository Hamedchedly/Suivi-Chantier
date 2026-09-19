// En-tête temporel : sélecteur de zoom (jour/semaine/mois/trimestre) + grille
// de dates. Le zoom ne change que l'échelle des colonnes, jamais les dates.
//
// Scindé en deux : la colonne « Lot / Tâche » (son propre volet, scroll
// vertical uniquement) et la grille de dates (volet qui scrolle aussi à
// l'horizontale). Les deux volets sont synchronisés verticalement par
// l'orchestrateur (Gantt.tsx) — un seul bloc avec `position: sticky` ne
// suffit pas à garder la colonne en place pendant le scroll horizontal.
import { TimelineScale, ZoomLevel, ZOOM_LEVELS, ZOOM_LABEL, headerCells, timelineWidth, dayTicks } from '../../../lib/planningViewModel'

export const HEADER_HEIGHT = 34
export const DAY_SUBROW_HEIGHT = 16

/** Hauteur totale de l'en-tête : la sous-ligne des repères journaliers
 * n'existe qu'en vue semaine — jamais une vue séparée, juste plus de détail. */
export function headerHeightFor(zoom: ZoomLevel): number {
  return zoom === 'week' ? HEADER_HEIGHT + DAY_SUBROW_HEIGHT : HEADER_HEIGHT
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

export function GanttHeaderTimeline({ scale, today }: { scale: TimelineScale; today: Date }) {
  const cells = headerCells(scale)
  const ticks = scale.zoom === 'week' ? dayTicks(scale, today) : []
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '2px solid var(--navy)', width: timelineWidth(scale), height: headerHeightFor(scale.zoom) }}>
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: c.x, width: c.width, top: 0, height: HEADER_HEIGHT, borderLeft: '1px solid var(--line)',
            background: c.isWeekend ? '#f8fafc' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: 'var(--muted)', boxSizing: 'border-box',
          }}
        >
          {c.label}
        </div>
      ))}
      {/* Repères journaliers — uniquement en vue semaine, jamais une vue séparée. */}
      {ticks.map((t, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: t.x, width: t.width, top: HEADER_HEIGHT, height: DAY_SUBROW_HEIGHT,
            borderLeft: '1px solid var(--line)', boxSizing: 'border-box',
            background: t.isToday ? 'rgba(220,38,38,.08)' : t.isWeekend ? '#f8fafc' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: t.isToday ? 800 : 500, color: t.isToday ? 'var(--bad)' : 'var(--muted)',
          }}
        >
          {t.label}
        </div>
      ))}
    </div>
  )
}
