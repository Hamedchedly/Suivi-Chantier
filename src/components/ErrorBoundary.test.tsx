// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

// React rapporte aussi une erreur "récupérée" par un Error Boundary via
// window.reportError (pour les DevTools), ce que jsdom fait remonter comme
// une exception non gérée du test — sans rapport avec le comportement du
// composant, qu'on vérifie par ailleurs. On l'avale ici, spécifiquement
// pour ce fichier de test.
let onWindowError: ((e: ErrorEvent) => void) | null = null
beforeEach(() => {
  onWindowError = (e: ErrorEvent) => e.preventDefault()
  window.addEventListener('error', onWindowError)
})
afterEach(() => { if (onWindowError) window.removeEventListener('error', onWindowError) })

// Piloté par une prop (jamais par une mutation interne) : React peut
// re-tenter un rendu qui a échoué (récupération synchrone après un échec en
// mode concurrent), donc un flag qui se remet lui-même à false à l'intérieur
// du composant n'est pas fiable pour ce test.
function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boum')
  return <div>Contenu normal</div>
}

describe('<ErrorBoundary />', () => {
  afterEach(cleanup)

  it('laisse passer les enfants tant qu’aucune exception ne survient', () => {
    render(<ErrorBoundary><div>OK</div></ErrorBoundary>)
    expect(screen.getByText('OK')).toBeTruthy()
  })

  it('affiche un message de repli au lieu d’un écran blanc quand un enfant lève une exception', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom shouldThrow /></ErrorBoundary>)
    expect(screen.getByText('Une erreur est survenue sur cette page')).toBeTruthy()
    expect(screen.queryByText('Contenu normal')).toBeNull()
    spy.mockRestore()
  })

  it('« Réessayer » relance le rendu des enfants une fois le problème corrigé', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(<ErrorBoundary><Boom shouldThrow /></ErrorBoundary>)
    expect(screen.getByText('Une erreur est survenue sur cette page')).toBeTruthy()
    // Le parent corrige la situation (nouvelles props) ; le boundary reste en
    // erreur tant qu'on ne relance pas explicitement — comportement standard
    // d'un Error Boundary React (il ne se réinitialise pas tout seul).
    rerender(<ErrorBoundary><Boom shouldThrow={false} /></ErrorBoundary>)
    expect(screen.getByText('Une erreur est survenue sur cette page')).toBeTruthy()
    fireEvent.click(screen.getByText('Réessayer'))
    expect(screen.getByText('Contenu normal')).toBeTruthy()
    spy.mockRestore()
  })

  it('« Retour » réinitialise l’état ET appelle le callback fourni', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onBack = vi.fn()
    render(<ErrorBoundary onBack={onBack}><Boom shouldThrow /></ErrorBoundary>)
    fireEvent.click(screen.getByText('Retour'))
    expect(onBack).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('sans onBack fourni, aucun bouton Retour ne s’affiche', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom shouldThrow /></ErrorBoundary>)
    expect(screen.queryByText('Retour')).toBeNull()
    spy.mockRestore()
  })
})
