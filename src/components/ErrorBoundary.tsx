import { Component, type ReactNode } from 'react'

// Filet de sécurité minimal : une exception React non interceptée dans une
// page (Structure, Planning, Visite, Finances, Rapports…) ne doit jamais
// blanchir toute l'application. Ce composant n'entoure que la zone de
// contenu de la page (voir App.tsx, .app-body) — la navigation reste hors de
// son périmètre et donc toujours utilisable pour revenir en arrière.

interface Props {
  children: ReactNode
  onBack?: () => void
}

interface State {
  error: Error | null
}

const btnStyle: React.CSSProperties = {
  padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1',
  background: '#fff', color: '#1e293b', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Erreur non interceptée dans une page :', error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
          Une erreur est survenue sur cette page
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted, #64748b)', marginBottom: '20px' }}>
          Vous pouvez réessayer, ou revenir en arrière.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={this.retry} style={{ ...btnStyle, background: '#02457A', color: '#fff', borderColor: '#02457A' }}>
            Réessayer
          </button>
          {this.props.onBack && (
            <button onClick={() => { this.setState({ error: null }); this.props.onBack!() }} style={btnStyle}>
              Retour
            </button>
          )}
        </div>
        {import.meta.env.DEV && (
          <pre style={{
            marginTop: '24px', textAlign: 'left', fontSize: '11px', color: '#b91c1c',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '12px', overflow: 'auto', maxHeight: '240px', maxWidth: '720px',
            marginLeft: 'auto', marginRight: 'auto',
          }}>
            {error.message}
            {'\n\n'}{error.stack}
          </pre>
        )}
      </div>
    )
  }
}
