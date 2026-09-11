import { useState } from 'react'
import { Share2, Copy, Check, ClipboardCheck, ChevronRight, Calendar } from 'lucide-react'
import { Documents } from './Documents'
import { buildSnapshot, buildShareUrl } from '../../lib/share'
import { getVisits } from '../../lib/repo'
import { visitKindLabel } from '../../lib/visits'
import type { Page } from '../layout/navConfig'

// Comptes rendus are produced by the Visite module — a CR always comes from a
// real session. This page lists them and carries the read-only MOA share link.

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  terminee: { label: 'Brouillon', bg: '#f1f5f9', fg: '#475569' },
  cr_pret: { label: 'CR prêt', bg: '#fef3c7', fg: '#b45309' },
  diffuse: { label: 'Diffusé', bg: '#dcfce7', fg: '#15803d' },
  verrouille: { label: 'Verrouillé', bg: '#ede9fe', fg: '#6d28d9' },
}

const fmtFr = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso }

export function Reports({ onNavigate }: { onNavigate?: (p: Page) => void }) {
  const [tab, setTab] = useState<'cr' | 'docs'>('cr')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const visits = getVisits().filter(v => v.status !== 'en_cours')

  const generateShare = async () => {
    const url = buildShareUrl(buildSnapshot())
    setShareUrl(url)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // clipboard blocked — the field below lets the user copy manually
    }
  }

  const segmented = (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
      {(['cr', 'docs'] as const).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#02457A' : '#5b7183', boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
        >
          {t === 'cr' ? 'Comptes-rendus' : 'RFI · Visas · Docs'}
        </button>
      ))}
    </div>
  )

  if (tab === 'docs') {
    return (
      <div style={{ padding: '12px', paddingBottom: '80px' }}>
        {segmented}
        <Documents />
      </div>
    )
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {segmented}

      {onNavigate && (
        <button
          onClick={() => onNavigate('visite')}
          style={{ width: '100%', marginBottom: '16px', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #02457A, #018ABE)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <ClipboardCheck size={17} />
          Produire un CR depuis une visite
        </button>
      )}

      <button
        onClick={generateShare}
        style={{ width: '100%', marginBottom: shareUrl ? '10px' : '16px', padding: '12px', borderRadius: '12px', border: '1px solid #d1dce5', background: '#fff', color: 'var(--navy)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <Share2 size={16} />
        Partager le suivi (MOA — lecture seule)
      </button>
      {shareUrl && (
        <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '10px', background: 'var(--ok-bg)', border: '1px solid #cbe8d5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--ok)', marginBottom: '6px' }}>
            {copied ? <><Check size={14} /> Lien copié — la MOA peut consulter sans compte</> : 'Lien de partage prêt'}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1dce5', fontSize: '11px', background: '#fff', color: 'var(--muted)' }} />
            <button onClick={() => { navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true)).catch(() => {}) }} style={{ padding: '8px 10px', borderRadius: '6px', border: 'none', background: 'var(--navy)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Copier">
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
        Comptes rendus de visite
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visits.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#5b7183', fontSize: '13px', borderRadius: '8px', background: '#f9fbfd', border: '1px solid #e4ecf2' }}>
            Aucun CR pour l'instant — terminez une visite pour en produire un.
          </div>
        ) : (
          visits.map(v => {
            const st = STATUS[v.status] ?? STATUS.terminee
            return (
              <button
                key={v.id}
                onClick={() => onNavigate?.('visite')}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', cursor: onNavigate ? 'pointer' : 'default', textAlign: 'left', width: '100%' }}
              >
                <Calendar size={17} color="var(--muted)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#02457A' }}>
                    {visitKindLabel(v)} — {fmtFr(v.date)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#5b7183' }}>
                    {v.title ? `${v.title} • ` : ''}{v.zones.length} zones • {v.participants.length} participants
                  </div>
                </div>
                <span style={{ padding: '4px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: st.bg, color: st.fg }}>{st.label}</span>
                {onNavigate && <ChevronRight size={14} color="var(--muted)" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
