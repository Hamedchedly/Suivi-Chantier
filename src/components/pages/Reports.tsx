import { useState } from 'react'
import { Share2, Copy, Check, ClipboardCheck, ChevronRight, ChevronDown, Calendar, Printer, History, StickyNote, Users } from 'lucide-react'
import { Documents } from './Documents'
import { buildSnapshot, buildShareUrl } from '../../lib/share'
import { getVisits } from '../../lib/repo'
import { visitKindLabel, type Visit, type CrData } from '../../lib/visits'
import type { Page } from '../layout/navConfig'

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  terminee:  { label: 'Brouillon',  bg: '#f1f5f9', fg: '#475569' },
  cr_pret:   { label: 'CR prêt',    bg: '#fef3c7', fg: '#b45309' },
  diffuse:   { label: 'Diffusé',    bg: '#dcfce7', fg: '#15803d' },
  verrouille:{ label: 'Verrouillé', bg: '#ede9fe', fg: '#6d28d9' },
}

const fmtFr = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso }
const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function printCr(v: Visit, cr: CrData) {
  const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8">
<title>Compte rendu — ${fmtFr(v.date)}</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 13px; color: #16222e; margin: 24px 36px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #02457A; }
  .sub { font-size: 12px; color: #5c6f80; margin-bottom: 20px; }
  .section { margin-bottom: 18px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #5c6f80; margin-bottom: 5px; }
  .text { white-space: pre-wrap; border: 1px solid #e3e9ee; border-radius: 6px; padding: 10px 12px; background: #f9fbfd; }
  .audit { font-size: 11px; color: #5c6f80; border-top: 1px solid #e3e9ee; padding-top: 12px; margin-top: 12px; }
  .audit-row { margin-bottom: 6px; }
  .del { color: #b45309; background: #fff7ed; padding: 2px 5px; border-radius: 3px; }
  .add { color: #065f46; background: #ecfdf5; padding: 2px 5px; border-radius: 3px; }
  @media print { body { margin: 12mm 18mm; } }
</style>
</head><body>
<h1>${visitKindLabel(v)} — ${fmtFr(v.date)}</h1>
<div class="sub">
  ${v.participants.map(p => p.name).join(', ') || '(Aucun participant renseigné)'}
  ${v.companiesPresent?.length ? ' · ' + v.companiesPresent.join(', ') : ''}
  ${v.diffusedAt ? ' · Diffusé le ' + fmtTime(v.diffusedAt) : ''}
</div>
${cr.synthese ? `<div class="section"><div class="label">Synthèse</div><div class="text">${escHtml(cr.synthese)}</div></div>` : ''}
${cr.conclusions ? `<div class="section"><div class="label">Conclusions</div><div class="text">${escHtml(cr.conclusions)}</div></div>` : ''}
${cr.nextMeeting ? `<div class="section"><div class="label">Prochaine réunion</div><div class="text">${escHtml(cr.nextMeeting)}</div></div>` : ''}
${(v.auditLog ?? []).length > 0 ? `
<div class="audit">
  <div class="label">Journal des modifications (${v.auditLog!.length})</div>
  ${[...v.auditLog!].reverse().map(e => `
    <div class="audit-row">
      <strong>${e.field}</strong> modifié par ${e.by} · ${new Date(e.at).toLocaleString('fr-FR')}
      ${e.from ? `<br><span class="del">− ${escHtml(String(e.from))}</span>` : ''}
      ${e.to   ? `<br><span class="add">+ ${escHtml(String(e.to))}</span>` : ''}
    </div>`).join('')}
</div>` : ''}
</body></html>`
  const w = window.open('', '_blank', 'width=800,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function CrInline({ v }: { v: Visit }) {
  const cr = v.cr
  if (!cr) {
    return <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--muted)' }}>Aucun CR rédigé pour cette session.</div>
  }
  const hasSomething = cr.synthese || cr.conclusions || cr.nextMeeting
  return (
    <div style={{ padding: '14px', borderTop: '1px solid var(--line)', background: '#f9fbfd' }}>
      {hasSomething ? (
        <>
          {cr.synthese && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '4px' }}>Synthèse</div>
              <div style={{ fontSize: '12px', color: 'var(--ink)', whiteSpace: 'pre-wrap', background: '#fff', border: '1px solid var(--line)', borderRadius: '7px', padding: '8px 10px', lineHeight: 1.6 }}>{cr.synthese}</div>
            </div>
          )}
          {cr.conclusions && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '4px' }}>Conclusions</div>
              <div style={{ fontSize: '12px', color: 'var(--ink)', whiteSpace: 'pre-wrap', background: '#fff', border: '1px solid var(--line)', borderRadius: '7px', padding: '8px 10px', lineHeight: 1.6 }}>{cr.conclusions}</div>
            </div>
          )}
          {cr.nextMeeting && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '4px' }}>Prochaine réunion</div>
              <div style={{ fontSize: '12px', color: 'var(--ink)', background: '#fff', border: '1px solid var(--line)', borderRadius: '7px', padding: '8px 10px' }}>{cr.nextMeeting}</div>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>CR en brouillon — aucun texte saisi.</div>
      )}

      {(v.auditLog ?? []).length > 0 && (
        <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <History size={11} /> Journal ({v.auditLog!.length} modif.)
          </div>
          {[...v.auditLog!].reverse().slice(0, 5).map((e, i) => {
            const date = new Date(e.at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={i} style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                <strong style={{ color: 'var(--ink)' }}>{e.field}</strong> · {e.by} · {date}
                {e.from && <div style={{ color: '#b45309', background: '#fff7ed', padding: '2px 6px', borderRadius: '4px', marginTop: '2px', whiteSpace: 'pre-wrap' }}>− {e.from}</div>}
                {e.to   && <div style={{ color: '#065f46', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', marginTop: '1px', whiteSpace: 'pre-wrap' }}>+ {e.to}</div>}
              </div>
            )
          })}
          {v.auditLog!.length > 5 && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>… et {v.auditLog!.length - 5} autre(s) dans la session Visite.</div>}
        </div>
      )}

      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => printCr(v, cr)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }}
        >
          <Printer size={13} /> Imprimer / PDF
        </button>
        {v.participants.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '3px', padding: '7px 0' }}>
            {v.participants.map(p => p.name).join(' · ')}
            {v.companiesPresent?.length ? ' · ' + v.companiesPresent.join(', ') : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function NotesUnifiees() {
  const visits = getVisits().filter(v => v.notes.length > 0)
  const [company, setCompany] = useState<string>('all')

  const allCompanies = [...new Set(
    visits.flatMap(v => v.notes.filter(n => n.company).map(n => n.company!))
  )].sort()

  const filtered = visits
    .map(v => ({
      v,
      notes: company === 'all' ? v.notes : v.notes.filter(n => n.company === company || (n.scope === 'all' && company === 'all')),
    }))
    .filter(x => x.notes.length > 0)

  const fmtFrLocal = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso }

  if (visits.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#5b7183', fontSize: '13px', borderRadius: '8px', background: '#f9fbfd', border: '1px solid #e4ecf2' }}>Aucune note de session. Les notes se saisissent depuis une visite en cours.</div>
  }

  return (
    <div>
      {allCompanies.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {(['all', ...allCompanies]).map(c => (
            <button key={c} onClick={() => setCompany(c)} style={{ padding: '5px 12px', borderRadius: '16px', border: '1px solid var(--line)', background: company === c ? 'var(--accent)' : '#fff', color: company === c ? '#fff' : 'var(--muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              {c === 'all' ? 'Toutes' : c}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(({ v, notes }) => (
          <div key={v.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
              <Calendar size={13} color="var(--muted)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>{visitKindLabel(v)} — {fmtFrLocal(v.date)}</span>
              <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: 'auto' }}>{notes.length} note{notes.length > 1 ? 's' : ''}</span>
            </div>
            {notes.map(n => (
              <div key={n.id} style={{ padding: '9px 12px', borderBottom: '1px solid var(--line)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {n.scope === 'company'
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '10px', background: '#ede9fe', color: '#6d28d9', fontSize: '10px', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}><Users size={9} />{n.company}</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '10px', background: '#e7f0fb', color: '#02457A', fontSize: '10px', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}><StickyNote size={9} />Tous</span>}
                <span style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.5 }}>{n.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Reports({ onNavigate }: { onNavigate?: (p: Page) => void }) {
  const [tab, setTab] = useState<'cr' | 'notes' | 'docs'>('cr')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
      {(['cr', 'notes', 'docs'] as const).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#02457A' : '#5b7183', boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
        >
          {t === 'cr' ? 'Comptes-rendus' : t === 'notes' ? 'Notes de session' : 'RFI · Visas · Docs'}
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

  if (tab === 'notes') {
    return (
      <div style={{ padding: '12px', paddingBottom: '80px' }}>
        {segmented}
        <NotesUnifiees />
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
        Comptes rendus de visite ({visits.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visits.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#5b7183', fontSize: '13px', borderRadius: '8px', background: '#f9fbfd', border: '1px solid #e4ecf2' }}>
            Aucun CR pour l'instant — terminez une visite pour en produire un.
          </div>
        ) : (
          visits.map(v => {
            const st = STATUS[v.status] ?? STATUS.terminee
            const isOpen = expandedId === v.id
            return (
              <div key={v.id} style={{ borderRadius: '10px', border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--line)'}`, background: '#fff', overflow: 'hidden', boxShadow: isOpen ? '0 0 0 2px rgba(2,69,122,.07)' : 'none' }}>
                <button
                  onClick={() => setExpandedId(isOpen ? null : v.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Calendar size={17} color="var(--muted)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#02457A' }}>
                      {visitKindLabel(v)} — {fmtFr(v.date)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#5b7183' }}>
                      {v.title ? `${v.title} • ` : ''}{v.zones.length} zones • {v.participants.length} présents
                      {v.diffusedAt ? ` • diffusé ${fmtFr(v.diffusedAt.slice(0, 10))}` : ''}
                    </div>
                  </div>
                  <span style={{ padding: '4px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: st.bg, color: st.fg, flexShrink: 0 }}>{st.label}</span>
                  {isOpen ? <ChevronDown size={14} color="var(--muted)" /> : <ChevronRight size={14} color="var(--muted)" />}
                </button>
                {isOpen && <CrInline v={v} />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
