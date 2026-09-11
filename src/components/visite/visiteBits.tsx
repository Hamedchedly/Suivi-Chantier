// Small presentational primitives shared across the Visite module.
// Components only — styles and metadata live in visiteStyles.ts.

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>{label}</label>
    {children}
  </div>
)

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '6px 0' }}>{children}</div>
)

export const Stat = ({ n, label, dot }: { n: number; label: string; dot: string }) => (
  <div style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', textAlign: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot }} />
      <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy)' }}>{n}</span>
    </div>
    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{label}</div>
  </div>
)

/** Thin progress bar. */
export const Bar = ({ value, color = 'var(--navy-2)' }: { value: number; color?: string }) => (
  <div style={{ height: '6px', borderRadius: '3px', background: '#eef2f6', overflow: 'hidden' }}>
    <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color, transition: 'width .2s' }} />
  </div>
)
