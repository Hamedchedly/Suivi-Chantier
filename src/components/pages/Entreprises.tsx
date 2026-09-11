import { useState, useEffect } from 'react'
import {
  Building2, ChevronRight, ArrowLeft, Mail, Phone, AlertTriangle, Flag, Eye,
  Handshake, CalendarClock, ClipboardCheck, Check, X,
} from 'lucide-react'
import {
  getLotsConfig, getReserves, getCommitments, getVisits, getGanttTasks,
} from '../../lib/repo'
import {
  listCompanies, lotsOfCompany, openActionsOfCompany, observationsOfCompany,
  commitmentsOfCompany, commitmentVerdict, visitsOfCompany, companySummary,
} from '../../lib/companies'
import { lotSummaries } from '../../lib/schedule'
import { setBackHandler } from '../../lib/backHandler'
import { PRIORITY_META, badge, sectionLabel, linkBtn, zoneRow } from '../visite/visiteStyles'
import { Empty, Bar } from '../visite/visiteBits'

const fmtFr = (iso?: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d ? `${d}/${m}/${y}` : iso
}
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
}

/** Everything owed by, and known about, each entreprise on the chantier. */
export function Entreprises() {
  const [selected, setSelected] = useState<string | null>(null)

  // Back closes the open sheet before leaving the page.
  useEffect(() => {
    setBackHandler(() => {
      if (!selected) return false
      setSelected(null)
      return true
    })
    return () => setBackHandler(null)
  }, [selected])

  const lots = getLotsConfig()
  const reserves = getReserves()
  const commitments = getCommitments()
  const visits = getVisits()
  const today = todayIso()

  if (selected) {
    return (
      <CompanySheet
        company={selected}
        onBack={() => setSelected(null)}
        lots={lots}
        reserves={reserves}
        commitments={commitments}
        visits={visits}
        today={today}
      />
    )
  }

  const companies = listCompanies(lots)

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <div style={sectionLabel}>Entreprises ({companies.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {companies.length === 0 && <Empty>Aucune entreprise configurée.</Empty>}
        {companies.map(c => {
          const s = companySummary(c, lots, reserves, commitments, today)
          const alert = s.overdueActions + s.brokenCommitments
          return (
            <button key={c} onClick={() => setSelected(c)} style={{ ...zoneRow, alignItems: 'flex-start', padding: '13px 14px' }}>
              <Building2 size={18} color="var(--muted)" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>{c}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {s.lotCount} lot{s.lotCount > 1 ? 's' : ''} · {s.openActions} action{s.openActions > 1 ? 's' : ''} ouverte{s.openActions > 1 ? 's' : ''}
                </div>
              </div>
              {alert > 0 && (
                <span style={{ ...badge, background: '#fdecec', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertTriangle size={10} />{alert}
                </span>
              )}
              <ChevronRight size={15} color="var(--muted)" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CompanySheet({ company, onBack, lots, reserves, commitments, visits, today }: {
  company: string
  onBack: () => void
  lots: ReturnType<typeof getLotsConfig>
  reserves: ReturnType<typeof getReserves>
  commitments: ReturnType<typeof getCommitments>
  visits: ReturnType<typeof getVisits>
  today: string
}) {
  const myLots = lotsOfCompany(lots, company)
  const actions = openActionsOfCompany(reserves, lots, company)
  const observations = observationsOfCompany(reserves, lots, company)
  const promises = commitmentsOfCompany(commitments, lots, company)
  const sessions = visitsOfCompany(visits, lots, company)
  const summaries = lotSummaries(getGanttTasks(), new Date())
  const contact = myLots[0]

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: '10px' }}><ArrowLeft size={15} /> Entreprises</button>

      <h2 style={{ margin: '0 0 4px' }}>{company}</h2>
      {contact && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
          <span>{contact.contactName}</span>
          {contact.email && <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--navy-2)' }}><Mail size={12} /> {contact.email}</a>}
          {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--navy-2)' }}><Phone size={12} /> {contact.phone}</a>}
        </div>
      )}

      <div style={sectionLabel}>Lots ({myLots.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
        {myLots.map(l => {
          const s = summaries.find(x => x.lotId === l.id)
          return (
            <div key={l.id} style={{ padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                  {l.id} — {l.name.replace(/^LOT\s*\d+\s*-\s*/, '')}
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--navy)' }}>{s?.progress ?? 0}%</strong>
                {s?.late && <span style={{ ...badge, background: '#fdecec', color: '#dc2626' }}>+{s.drift} j</span>}
              </div>
              <Bar value={s?.progress ?? 0} color={s?.late ? '#dc2626' : 'var(--navy-2)'} />
            </div>
          )
        })}
      </div>

      <div style={sectionLabel}>Actions ouvertes ({actions.length})</div>
      {actions.length === 0 ? <Empty>Aucune action en attente.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {actions.map(a => {
            const overdue = !!a.dueDate && a.dueDate < today
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', borderLeft: `3px solid ${overdue ? '#dc2626' : '#f59e0b'}`, background: '#fff' }}>
                <Flag size={14} color={overdue ? '#dc2626' : '#b45309'} style={{ marginTop: '1px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--ink)' }}>
                    <strong style={{ color: 'var(--navy)' }}>{a.number}</strong> {a.description}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {a.logementId} · {a.lotId}
                    {a.dueDate && <span style={{ color: overdue ? '#dc2626' : 'inherit', fontWeight: overdue ? 700 : 400 }}> · échéance {fmtFr(a.dueDate)}{overdue ? ' — dépassée' : ''}</span>}
                  </div>
                </div>
                <span style={{ ...badge, background: PRIORITY_META[a.priority].bg, color: PRIORITY_META[a.priority].fg }}>{PRIORITY_META[a.priority].label}</span>
              </div>
            )
          })}
        </div>
      )}

      <div style={sectionLabel}>Engagements ({promises.length})</div>
      {promises.length === 0 ? <Empty>Aucun engagement pris.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {promises.map(p => {
            const verdict = commitmentVerdict(p, today)
            const meta = verdict === 'kept' ? { label: 'Tenu', bg: '#dcfce7', fg: '#15803d', icon: <Check size={11} /> }
              : verdict === 'broken' ? { label: 'Non tenu', bg: '#fdecec', fg: '#dc2626', icon: <X size={11} /> }
              : { label: 'En attente', bg: '#fef3c7', fg: '#b45309', icon: <CalendarClock size={11} /> }
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}>
                <Handshake size={14} color="#6d28d9" style={{ marginTop: '1px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--ink)' }}>{p.label ?? p.taskId}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    Annoncé le {fmtFr(p.visitDate)} · pour le {fmtFr(p.promisedEnd)}
                  </div>
                </div>
                <span style={{ ...badge, background: meta.bg, color: meta.fg, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {meta.icon}{meta.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {observations.length > 0 && (
        <>
          <div style={sectionLabel}>Observations ({observations.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '18px' }}>
            {observations.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px' }}>
                <Eye size={13} color="#5b7183" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{o.description}</span>
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{o.logementId}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={sectionLabel}>Historique des visites ({sessions.length})</div>
      {sessions.length === 0 ? <Empty>Cette entreprise n'a pas encore été contrôlée en visite.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}>
              <ClipboardCheck size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--ink)' }}>
                {fmtFr(s.date)}{s.title ? ` — ${s.title}` : ''}
              </span>
              {s.progress !== null && <strong style={{ fontSize: '13px', color: 'var(--navy)' }}>{s.progress}%</strong>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
