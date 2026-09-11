import { useEffect, useRef, useState } from 'react'
import { Building2, Check, FolderKanban, LogOut, User as UserIcon, Users } from 'lucide-react'
import { User, isSuperadmin } from '../../lib/auth'
import { Project, projectLabel } from '../../lib/projects'
import type { Page } from './navConfig'

interface Props {
  user: User
  projects: Project[]
  currentProjectId: string | null
  onSwitchProject: (id: string) => void
  onNavigate: (p: Page) => void
  onSignOut: () => void
}

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
  padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer',
  fontSize: '13px', color: 'var(--navy)', textAlign: 'left',
}

export function AccountMenu({
  user, projects, currentProjectId, onSwitchProject, onNavigate, onSignOut,
}: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // Fermer au clic extérieur et à Échap — le menu ne doit pas piéger la navigation.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (p: Page) => { setOpen(false); onNavigate(p) }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Compte et opérations"
        aria-expanded={open}
        title={user.displayName}
        style={{
          width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
          border: '1.5px solid rgba(255,255,255,.45)', background: 'rgba(255,255,255,.16)',
          color: '#fff', fontSize: '12px', fontWeight: 700, letterSpacing: '.02em',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {initials(user.displayName)}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '44px', right: 0, zIndex: 300, width: '262px',
          background: '#fff', border: '1px solid var(--line)', borderRadius: '12px',
          boxShadow: '0 12px 34px rgba(2,27,72,.26)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--navy)' }}>{user.displayName}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {user.username}
              {isSuperadmin(user) && <strong style={{ color: '#6d28d9' }}> · super-admin</strong>}
            </div>
          </div>

          <div style={{ borderBottom: '1px solid var(--line)', maxHeight: '198px', overflowY: 'auto' }}>
            <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Mes opérations
            </div>
            {projects.length === 0 && (
              <div style={{ padding: '2px 12px 10px', fontSize: '12px', color: 'var(--muted)' }}>
                Aucune opération. Créez-en une pour commencer.
              </div>
            )}
            {projects.map(p => {
              const active = p.id === currentProjectId
              return (
                <button key={p.id} onClick={() => { setOpen(false); onSwitchProject(p.id) }}
                  style={{ ...row, background: active ? 'var(--sky-soft)' : 'none', fontWeight: active ? 700 : 400 }}>
                  <Building2 size={15} style={{ flexShrink: 0, color: 'var(--muted)' }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {projectLabel(p)}
                  </span>
                  {active && <Check size={14} style={{ flexShrink: 0, color: 'var(--ok)' }} />}
                </button>
              )
            })}
          </div>

          <button onClick={() => go('projets')} style={row}>
            <FolderKanban size={15} style={{ color: 'var(--muted)' }} /> Gérer mes opérations
          </button>
          <button onClick={() => go('moncompte')} style={row}>
            <UserIcon size={15} style={{ color: 'var(--muted)' }} /> Mon compte
          </button>
          {isSuperadmin(user) && (
            <button onClick={() => go('comptes')} style={row}>
              <Users size={15} style={{ color: 'var(--muted)' }} /> Comptes utilisateurs
            </button>
          )}
          <button onClick={() => { setOpen(false); onSignOut() }}
            style={{ ...row, color: 'var(--danger, #b42318)', borderTop: '1px solid var(--line)' }}>
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
