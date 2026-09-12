// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { SavedIndicator } from './SavedIndicator'

// L'indicateur est le span porteur du texte ; on lit son opacité inline.
const pill = () => screen.getByText('Enregistré').closest('span') as HTMLElement

describe('<SavedIndicator />', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('reste masqué au premier rendu (ouverture de l’écran)', () => {
    render(<SavedIndicator watch={1} />)
    expect(pill().style.opacity).toBe('0')
  })

  it('apparaît quand la valeur observée change', () => {
    const { rerender } = render(<SavedIndicator watch={1} />)
    rerender(<SavedIndicator watch={2} />)
    expect(pill().style.opacity).toBe('1')
  })

  it('disparaît après le délai', () => {
    const { rerender } = render(<SavedIndicator watch={1} />)
    rerender(<SavedIndicator watch={2} />)
    act(() => { vi.advanceTimersByTime(1500) })
    expect(pill().style.opacity).toBe('0')
  })

  it('accepte un libellé personnalisé', () => {
    render(<SavedIndicator watch={1} label="Sauvegardé" />)
    expect(screen.getByText('Sauvegardé')).toBeDefined()
  })
})
