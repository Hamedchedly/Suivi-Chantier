// @vitest-environment jsdom
// ────────────────────────────────────────────────────────────────────────────
// SPRINT PLANNING + JOURNAL CR — tests minimaux section 21, suite Planning :
// 21.2 (lot terminé replié par défaut), 21.7 (bascule Liste/Gantt desktop),
// 21.8 (bascule Liste/Gantt mobile).
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlanningGantt } from './Gantt'
import { GanttTask } from '../../../types/gantt'

afterEach(cleanup)

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const leaf = (id: string, title: string, progress: number, status: GanttTask['status']): GanttTask => ({
  id, lot_id: 'L', title,
  planned_start: d('2026-01-01'), planned_end: d('2026-01-10'), planned_duration: 10,
  progress, status, priority: 'medium', dependencies: [], is_milestone: false, is_critical: false,
})

const tasks: GanttTask[] = [
  {
    ...leaf('LOT-A', 'Lot terminé', 100, 'completed'),
    children: [leaf('t1', 'Tâche A1 (feuille cachée si replié)', 100, 'completed')],
  },
  {
    ...leaf('LOT-B', 'Lot en cours', 50, 'in-progress'),
    children: [leaf('t2', 'Tâche B1 (visible, lot ouvert)', 50, 'in-progress')],
  },
]

describe('sprint 21.2 — lot terminé replié par défaut au chargement', () => {
  it('affiche le badge Terminé sur le lot fini et masque ses feuilles ; le lot en cours reste ouvert', () => {
    render(<PlanningGantt tasks={tasks} commitments={[]} operationId="op" />)
    expect(screen.getByText('Lot terminé')).toBeDefined()
    expect(screen.getByText('Terminé')).toBeDefined()
    expect(screen.queryByText('Tâche A1 (feuille cachée si replié)')).toBeNull()
    expect(screen.getByText('Tâche B1 (visible, lot ouvert)')).toBeDefined()
  })
})

describe('sprint 21.7 — bascule [Liste][Gantt] desktop (défaut = Gantt)', () => {
  it('démarre en vue Gantt, bascule vers Liste puis revient', () => {
    render(<PlanningGantt tasks={tasks} commitments={[]} operationId="op" />)
    expect(screen.queryByText('Voir timeline')).toBeNull()
    fireEvent.click(screen.getByText('Liste'))
    expect(screen.getByText('Voir timeline')).toBeDefined()
    fireEvent.click(screen.getByText('Gantt'))
    expect(screen.queryByText('Voir timeline')).toBeNull()
  })
})

describe('sprint 21.8 — bascule Liste/Gantt mobile (défaut = Liste)', () => {
  it('sous 768px, démarre en Liste ; « Voir timeline » puis « Retour à la liste »', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 })
    render(<PlanningGantt tasks={tasks} commitments={[]} operationId="op" />)
    expect(screen.getByText('Voir timeline')).toBeDefined()
    fireEvent.click(screen.getByText('Voir timeline'))
    expect(screen.getByText('Retour à la liste')).toBeDefined()
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  })
})
