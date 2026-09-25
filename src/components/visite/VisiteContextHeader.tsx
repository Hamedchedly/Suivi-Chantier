import { ArrowLeft, ChevronRight } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>
  onBack?: () => void
  actions?: React.ReactNode
}

export function VisiteContextHeader(props: Props) {
  const { title, subtitle, breadcrumbs, onBack, actions } = props

  return (
    <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '16px', paddingBottom: '12px' }}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', color: '#94a3b8', flexWrap: 'wrap' }}>
          {breadcrumbs.map((bc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {i > 0 && <ChevronRight size={14} color="#cbd5e1" />}
              {bc.onClick ? (
                <button
                  onClick={bc.onClick}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    fontSize: 'inherit',
                  }}
                >
                  {bc.label}
                </button>
              ) : (
                <span>{bc.label}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f1628', margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
          </div>
          {subtitle && (
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', marginLeft: '32px' }}>
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </div>
  )
}
