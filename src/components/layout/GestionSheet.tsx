import { X } from 'lucide-react'
import { Page, GESTION_GROUPS } from './navConfig'

interface Props {
  open: boolean
  currentPage: Page
  onClose: () => void
  onPick: (p: Page) => void
  canAccess?: (p: Page) => boolean
}

export function GestionSheet({ open, currentPage, onClose, onPick, canAccess }: Props) {
  if (!open) return null
  const groups = GESTION_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => !canAccess || canAccess(i.id)) }))
    .filter(g => g.items.length > 0)
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,27,72,.45)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: '#fff',
        borderTopLeftRadius: '18px', borderTopRightRadius: '18px',
        padding: '10px 14px calc(18px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -8px 30px rgba(2,27,72,.25)',
        maxWidth: '520px', margin: '0 auto', maxHeight: '82vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 10px' }}>
          <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '15px' }}>Plus</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
        </div>
        {groups.map(group => (
          <div key={group.title} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '6px 2px' }}>
              {group.title}
            </div>
            {group.items.map(({ id, label, desc, icon: Icon }) => (
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
        ))}
      </div>
    </>
  )
}
