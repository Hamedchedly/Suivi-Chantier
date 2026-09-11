// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DpgfView } from './DpgfView'
import { saveDpgf } from '../../lib/repo'
import { DEFAULT_DPGF } from '../../data/dpgfMock'

const totalText = () => screen.getByText('Total DPGF (HT)').nextElementSibling?.textContent ?? ''

// Un projet démarre vide : le jeu d'essai est semé explicitement par le test.
describe('<DpgfView /> — quantitatif & forfait', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); saveDpgf(DEFAULT_DPGF) })

  it('affiche le total et les lots semés', () => {
    render(<DpgfView />)
    expect(screen.getByText('LOT 05 — Menuiseries')).toBeDefined()
    expect(screen.getByText('LOT 07 — CVC')).toBeDefined()
    expect(totalText()).toMatch(/€/)
  })

  it('bascule une ligne en forfait et remplace qté/PU par un montant', () => {
    render(<DpgfView />)
    expect(screen.queryByPlaceholderText('Montant forfait HT')).toBeNull()
    fireEvent.click(screen.getAllByTitle('Basculer forfait')[0])
    expect(screen.getByPlaceholderText('Montant forfait HT')).toBeDefined()
  })

  it('le montant forfaitaire recalcule le total général', () => {
    render(<DpgfView />)
    const before = totalText()
    fireEvent.click(screen.getAllByTitle('Basculer forfait')[0])
    fireEvent.change(screen.getByPlaceholderText('Montant forfait HT'), { target: { value: '99999' } })
    expect(totalText()).not.toBe(before)
  })

  it('persiste le passage en forfait après remontage', () => {
    render(<DpgfView />)
    fireEvent.click(screen.getAllByTitle('Basculer forfait')[0])
    cleanup()
    render(<DpgfView />)
    expect(screen.getByPlaceholderText('Montant forfait HT')).toBeDefined()
  })
})
