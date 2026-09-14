import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, FileText, MessageSquare } from 'lucide-react'
import {
  Rfi, Visa, Doc, VisaStatus, nextRfiRef, countOpenRfis, countPendingVisas, fileSize,
} from '../../lib/admin'
import {
  getRfis, saveRfis, getVisas, saveVisas, getDocs, saveDocs, getLotsConfig, type LotContact,
} from '../../lib/repo'

type DocSection = 'rfi' | 'visa' | 'ged'

// Les lots viennent de la configuration réelle de l'opération active — jamais
// d'une liste figée (sinon les menus sont faux dès qu'on change d'opération).
const lotNameIn = (lots: LotContact[], id: string) => lots.find(l => l.id === id)?.name ?? id

const VISA_META: Record<VisaStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: '#fef3c7', fg: '#b45309' },
  approved: { label: 'Visé', bg: '#dcfce7', fg: '#15803d' },
  approved_reserves: { label: 'Visé avec réserves', bg: '#e7f0fb', fg: '#018ABE' },
  rejected: { label: 'Refusé', bg: '#fdecec', fg: '#dc2626' },
}

export function Documents() {
  const [section, setSection] = useState<DocSection>('rfi')
  const [rfis, setRfis] = useState<Rfi[]>(getRfis)
  const [visas, setVisas] = useState<Visa[]>(getVisas)
  const [docs, setDocs] = useState<Doc[]>(getDocs)

  const lots = useMemo(() => getLotsConfig(), [])

  useEffect(() => { saveRfis(rfis) }, [rfis])
  useEffect(() => { saveVisas(visas) }, [visas])
  useEffect(() => { saveDocs(docs) }, [docs])

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
        <Chip on={section === 'rfi'} onClick={() => setSection('rfi')} label={`RFI (${countOpenRfis(rfis)})`} />
        <Chip on={section === 'visa'} onClick={() => setSection('visa')} label={`Visas (${countPendingVisas(visas)})`} />
        <Chip on={section === 'ged'} onClick={() => setSection('ged')} label="Documents" />
      </div>

      {section === 'rfi' && <RfiView rfis={rfis} setRfis={setRfis} lots={lots} />}
      {section === 'visa' && <VisaView visas={visas} setVisas={setVisas} lots={lots} />}
      {section === 'ged' && <GedView docs={docs} setDocs={setDocs} />}
    </div>
  )
}

// ── RFI ──────────────────────────────────────────────────────────────────────
function RfiView({ rfis, setRfis, lots }: { rfis: Rfi[]; setRfis: React.Dispatch<React.SetStateAction<Rfi[]>>; lots: LotContact[] }) {
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [lotId, setLotId] = useState(lots[0]?.id ?? '')
  const [question, setQuestion] = useState('')
  const [answering, setAnswering] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')

  const add = () => {
    if (!subject.trim() || !question.trim()) return
    setRfis(prev => [{ id: `di${Date.now()}`, ref: nextRfiRef(prev), subject: subject.trim(), lotId, question: question.trim(), status: 'open', createdAt: new Date().toISOString().split('T')[0] }, ...prev])
    setSubject(''); setQuestion(''); setShowForm(false)
  }
  const submitAnswer = (id: string) => {
    if (!answerText.trim()) return
    setRfis(prev => prev.map(r => (r.id === id ? { ...r, answer: answerText.trim(), status: 'answered' } : r)))
    setAnswering(null); setAnswerText('')
  }

  return (
    <div>
      <button onClick={() => setShowForm(v => !v)} style={addBtn}><Plus size={16} /> Nouvelle demande (RFI)</button>
      {showForm && (
        <div style={{ ...card, marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet" style={{ ...inp, flex: 2 }} />
            <select value={lotId} onChange={e => setLotId(e.target.value)} style={{ ...inp, flex: 1 }}>
              {lots.length === 0 && <option value="">Aucun lot configuré</option>}
              {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Question..." style={{ ...inp, width: '100%', minHeight: '56px', marginBottom: '8px', resize: 'vertical' }} />
          <button onClick={add} style={okBtn}>Envoyer la demande</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rfis.map(r => (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ color: 'var(--navy)', fontSize: '13px' }}>{r.ref}</strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{lotNameIn(lots, r.lotId)}</span>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, background: r.status === 'answered' ? 'var(--ok-bg)' : 'var(--warn-bg)', color: r.status === 'answered' ? 'var(--ok)' : 'var(--warn)' }}>
                {r.status === 'answered' ? 'Répondue' : 'Ouverte'}
              </span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>{r.subject}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{r.question}</div>
            {r.answer && (
              <div style={{ marginTop: '6px', padding: '8px', background: '#f2f7fb', borderRadius: '6px', fontSize: '12px', color: 'var(--ink)' }}>
                <MessageSquare size={12} style={{ verticalAlign: '-1px', marginRight: 4, color: 'var(--navy-2)' }} />{r.answer}
              </div>
            )}
            {r.status === 'open' && (
              answering === r.id ? (
                <div style={{ marginTop: '8px' }}>
                  <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="Réponse..." style={{ ...inp, width: '100%', minHeight: '48px', marginBottom: '6px', resize: 'vertical' }} />
                  <button onClick={() => submitAnswer(r.id)} style={okBtn}>Enregistrer la réponse</button>
                </div>
              ) : (
                <button onClick={() => { setAnswering(r.id); setAnswerText('') }} style={{ ...ghostBtn, marginTop: '8px' }}>Répondre</button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VISA ─────────────────────────────────────────────────────────────────────
function VisaView({ visas, setVisas, lots }: { visas: Visa[]; setVisas: React.Dispatch<React.SetStateAction<Visa[]>>; lots: LotContact[] }) {
  const setStatus = (id: string, status: VisaStatus) =>
    setVisas(prev => prev.map(v => (v.id === id ? { ...v, status } : v)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {visas.map(v => {
        const meta = VISA_META[v.status]
        return (
          <div key={v.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>{v.docName}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Indice {v.index} • {lotNameIn(lots, v.lotId)} • {new Date(v.date).toLocaleDateString('fr')}</div>
              </div>
              <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, background: meta.bg, color: meta.fg, whiteSpace: 'nowrap' }}>{meta.label}</span>
            </div>
            {v.status === 'pending' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setStatus(v.id, 'approved')} style={{ ...ghostBtn, color: 'var(--ok)' }}>Viser</button>
                <button onClick={() => setStatus(v.id, 'approved_reserves')} style={{ ...ghostBtn, color: 'var(--navy-2)' }}>Viser avec réserves</button>
                <button onClick={() => setStatus(v.id, 'rejected')} style={{ ...ghostBtn, color: 'var(--bad)' }}>Refuser</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── GED ──────────────────────────────────────────────────────────────────────
function GedView({ docs, setDocs }: { docs: Doc[]; setDocs: React.Dispatch<React.SetStateAction<Doc[]>> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setDocs(prev => [{ id: `d${Date.now()}`, name: f.name, category: 'Import', version: 'V1', date: new Date().toISOString().split('T')[0], sizeKb: Math.max(1, Math.round(f.size / 1024)) }, ...prev])
  }
  return (
    <div>
      <input ref={fileRef} type="file" onChange={onPick} style={{ display: 'none' }} />
      <button onClick={() => fileRef.current?.click()} style={addBtn}><Plus size={16} /> Ajouter un document</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {docs.map(d => (
          <div key={d.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={22} color="var(--navy-2)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>{d.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{d.category} • {d.version} • {new Date(d.date).toLocaleDateString('fr')} • {fileSize(d.sizeKb)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 14px', borderRadius: '16px', border: on ? '1px solid var(--navy)' : '1px solid var(--line)', background: on ? 'var(--navy)' : '#fff', color: on ? '#fff' : 'var(--muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  )
}

const card: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', background: '#fff' }
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }
const addBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', marginBottom: '12px' }
const okBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--ok)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }
