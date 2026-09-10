import { X } from 'lucide-react'
import { Page, GESTION_ITEMS } from './navConfig'

interface Props {
  open: boolean
  currentPage: Page
  onClose: () => void
  onPick: (p: Page) => void
}

export function GestionSheet({ open, currentPage, onClose, onPick }: Props) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,27,72,.45)', zIndex: 200 }} />
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: '#fff', borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '10px 14px calc(18px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -8px 30px rgba(2,27,72,.25)', maxWidth: '520px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 10px' }}>
          <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '15px' }}>Gestion</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
        </div>
        {GESTION_ITEMS.map(({ id, label, desc, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onPick(id)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', background: currentPage === id ? 'var(--sky-soft)' : '#fff', marginBottom: '8px', cursor: 'pointer' }}
          >
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--sky-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={19} color="var(--navy)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '14px' }}>{label}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
