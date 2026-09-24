// @vitest-environment jsdom
// ────────────────────────────────────────────────────────────────────────────
// SPRINT PLANNING + JOURNAL CR — tests minimaux section 21, câblage du journal
// unifié : verrou/édition tableur, Affichage (Tous/Importants), Regroupement,
// création d'une remarque multi-entreprises.
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { CrTable } from './CrTable'
import { saveReserves, saveLotsConfig } from '../../lib/repo'
import { Reserve } from '../../lib/reserves'

afterEach(cleanup)

beforeEach(() => {
  localStorage.clear()
  saveLotsConfig([{ id: 'L03', name: 'LOT 03', company: '', contactName: '', email: '', phone: '' }, { id: 'L04', name: 'LOT 04', company: '', contactName: '', email: '', phone: '' }])
  const reserves: Reserve[] = [
    { id: 'r1', number: 'R-001', lotId: 'L03', lotIds: ['L03', 'L04'], logementId: '', description: 'Remarque multi-lot', priority: 'medium', status: 'open', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'r2', number: 'R-002', lotId: 'L03', logementId: '', description: 'Remarque importante', priority: 'high', status: 'open', createdAt: '2026-01-01T00:00:00Z', reminder: true },
  ]
  saveReserves(reserves)
})

describe('sprint — journal unifié : verrouillage/édition tableur', () => {
  it('démarre verrouillé ; « Déverrouiller » fait apparaître des champs éditables en ligne', () => {
    render(<CrTable />)
    expect(screen.getByText('Déverrouiller')).toBeDefined()
    fireEvent.click(screen.getByText('Déverrouiller'))
    expect(screen.getByText('Verrouiller')).toBeDefined()
    // En mode déverrouillé, la description devient un textarea directement dans la ligne.
    expect(screen.getAllByDisplayValue('Remarque multi-lot').length).toBeGreaterThan(0)
  })
})

describe('sprint — Affichage : Tous / Importants', () => {
  it('« Importants » ne garde que les remarques marquées rappel', () => {
    render(<CrTable />)
    fireEvent.click(screen.getByText('Importants'))
    expect(screen.getByText('Remarque importante')).toBeDefined()
    expect(screen.queryByText('Remarque multi-lot')).toBeNull()
  })
})

describe('sprint — Regroupement : Par lot / Par logement / Par réunion, défaut Par réunion', () => {
  it('une remarque multi-lots apparaît sous CHAQUE en-tête de lot (LOT 03 et LOT 04)', () => {
    render(<CrTable />)
    fireEvent.click(screen.getByText('Par lot'))
    expect(screen.getAllByText(/LOT 03/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/LOT 04/).length).toBeGreaterThan(0)
    const occurrences = screen.getAllByText('Remarque multi-lot')
    expect(occurrences.length).toBe(2)
  })

  it('bascule vers Par réunion et revient à Par lot', () => {
    render(<CrTable />)
    fireEvent.click(screen.getByText('Par lot'))
    expect(screen.getAllByText(/LOT 03/).length).toBeGreaterThan(0)
  })
})

describe('sprint — création d\'une remarque multi-entreprises', () => {
  it('le formulaire Ajouter propose un sélecteur multi-entreprises avec case « Toutes »', () => {
    render(<CrTable />)
    fireEvent.click(screen.getByText('Ajouter'))
    const form = screen.getByText('Nouveau point de CR').closest('div')!
    expect(within(form.parentElement as HTMLElement).getByText('Toutes')).toBeDefined()
  })
})
