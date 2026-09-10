// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Meetings } from './Meetings'

describe('<Meetings /> — câblage UI', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })

  it('affiche les réunions du seed et signale une action en retard', () => {
    render(<Meetings />)
    expect(screen.getByText('Réunion de chantier n°12')).toBeDefined()
    expect(screen.getByText('Réunion de chantier n°11')).toBeDefined()
    expect(screen.getAllByText(/en retard/).length).toBeGreaterThan(0)
  })

  it('affiche les décisions de la réunion dépliée par défaut', () => {
    render(<Meetings />)
    expect(screen.getByText('Validation du calepinage menuiseries indice B')).toBeDefined()
  })

  it('ajoute une décision et la persiste après remontage', () => {
    render(<Meetings />)
    const input = screen.getByPlaceholderText('Nouvelle décision…')
    fireEvent.change(input, { target: { value: 'Décision de test' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Décision de test')).toBeDefined()

    cleanup()
    render(<Meetings />)
    expect(screen.getByText('Décision de test')).toBeDefined()
  })

  it('solder une action bascule son bouton en « Rouvrir »', () => {
    render(<Meetings />)
    const doneBefore = screen.getAllByTitle('Rouvrir').length   // A-003 est déjà soldée
    fireEvent.click(screen.getAllByTitle('Solder')[0])
    expect(screen.getAllByTitle('Rouvrir').length).toBe(doneBefore + 1)
  })

  it('crée une nouvelle réunion', () => {
    render(<Meetings />)
    fireEvent.click(screen.getByTitle('Nouvelle réunion'))
    fireEvent.change(screen.getByPlaceholderText('Objet de la réunion'), { target: { value: 'Réunion n°13' } })
    fireEvent.click(screen.getByText('Créer'))
    expect(screen.getByText('Réunion n°13')).toBeDefined()
  })
})
