// @vitest-environment jsdom
// ────────────────────────────────────────────────────────────────────────────
// SPRINT PLANNING + JOURNAL CR — tests minimaux section 21, suite export CR :
// 21.16 (avancement par lot dans le CR, depuis le planning), 21.19 (dernière
// page paysage), 21.20 (aperçu et export = même arbre DOM, jamais deux
// composants séparés).
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CrExport } from './CrExport'
import { saveProjects, setCurrentProjectId, saveGanttTasks, saveReserves } from '../../lib/repo'
import { GanttTask } from '../../types/gantt'
import { Reserve } from '../../lib/reserves'

afterEach(cleanup)

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const lot = (id: string, title: string, progress: number): GanttTask => ({
  id, lot_id: id, title,
  planned_start: d('2026-01-01'), planned_end: d('2026-01-31'), planned_duration: 31,
  progress, status: progress >= 100 ? 'completed' : 'in-progress', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  children: [{
    id: `${id}-t1`, lot_id: id, parent_id: id, title: `${title} — tâche 1`,
    planned_start: d('2026-01-05'), planned_end: d('2026-01-10'), planned_duration: 6,
    progress, status: progress >= 100 ? 'completed' : 'in-progress', priority: 'medium',
    dependencies: [], is_milestone: false, is_critical: false,
  }],
})

beforeEach(() => {
  localStorage.clear()
  saveProjects([{ id: 'op1', name: 'Gambetta', createdAt: '2026-01-01T00:00:00Z' }])
  setCurrentProjectId('op1')
  saveGanttTasks([lot('LOT-A', 'Lot A — gros œuvre', 100), lot('LOT-B', 'Lot B — façade', 42)])
  saveReserves([])
})

describe('sprint 21.16 — avancement par lot dans le CR, depuis le planning (pas recalculé)', () => {
  it('affiche chaque lot avec son avancement réel du planning', () => {
    render(<CrExport reserves={[] as Reserve[]} lots={[]} crNumbers={[1]} onClose={() => {}} />)
    expect(screen.getByText('Lot A — gros œuvre')).toBeDefined()
    expect(screen.getByText('Lot B — façade')).toBeDefined()
    expect(screen.getByText('100%')).toBeDefined()
    expect(screen.getByText('42%')).toBeDefined()
  })
})

describe('sprint 21.19/21.20 — page paysage + aperçu=export (même arbre)', () => {
  it('le document imprimé (.cr-print-doc) contient la section paysage (.cr-page-gantt) dans le MÊME arbre affiché à l\'écran', () => {
    const { container } = render(<CrExport reserves={[] as Reserve[]} lots={[]} crNumbers={[1]} onClose={() => {}} />)
    const doc = container.querySelector('.cr-print-doc')
    expect(doc).not.toBeNull()
    const gantt = doc!.querySelector('.cr-page-gantt')
    expect(gantt).not.toBeNull()
    // Le nom de fichier suit le format des CR existants.
    expect(screen.getByText(/CR_N01\.pdf/)).toBeDefined()
  })
})
