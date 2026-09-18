import { ChevronRight } from 'lucide-react'
import type { Page } from './navConfig'

export interface Crumb {
  label: string
  href?: string
  active?: boolean
}

interface BreadcrumbsProps {
  crumbs: Crumb[]
  onNavigate?: (href: string) => void
}

export function Breadcrumbs({ crumbs, onNavigate }: BreadcrumbsProps) {
  if (!crumbs || crumbs.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', padding: '0 12px', marginBottom: '8px', flexWrap: 'wrap' }}>
      {crumbs.map((crumb, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {idx > 0 && <ChevronRight size={13} color="var(--muted)" />}
          {crumb.href && onNavigate ? (
            <button
              onClick={() => onNavigate(crumb.href!)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: crumb.active ? 'var(--navy)' : 'var(--muted)',
                fontWeight: crumb.active ? 600 : 400,
                padding: '0',
                textDecoration: crumb.active ? 'none' : 'underline',
                fontSize: '12px',
              }}
            >
              {crumb.label}
            </button>
          ) : (
            <span style={{ color: crumb.active ? 'var(--navy)' : 'var(--muted)', fontWeight: crumb.active ? 600 : 400 }}>
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Build breadcrumbs for the CR module based on current section and filters.
 * Example: CR > Journal CR > Search results (5 points)
 */
export function buildCrBreadcrumbs(section: 'journal' | 'notes' | 'reunions', searchTerm?: string, resultCount?: number): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'CR' }]

  if (section === 'journal') {
    crumbs.push({ label: 'Journal CR', active: true })
    if (searchTerm) {
      crumbs.push({ label: `"${searchTerm}"`, active: true })
      if (typeof resultCount === 'number') {
        crumbs.push({ label: `(${resultCount})`, active: true })
      }
    }
  } else if (section === 'notes') {
    crumbs.push({ label: 'Notes & suivi', active: true })
    if (searchTerm) {
      crumbs.push({ label: `"${searchTerm}"`, active: true })
    }
  } else if (section === 'reunions') {
    crumbs.push({ label: 'Réunions', active: true })
  }

  return crumbs
}
