import { Download, Eye, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { CRReport } from './CRReport'

interface Report {
  id: string
  number: number
  date: Date
  author: string
  status: 'draft' | 'sent'
  items: number
}

const MOCK_REPORTS: Report[] = [
  {
    id: 'R001',
    number: 1,
    date: new Date('2026-08-28'),
    author: 'Jean Dupont',
    status: 'sent',
    items: 12,
  },
  {
    id: 'R002',
    number: 2,
    date: new Date('2026-09-04'),
    author: 'Marie Martin',
    status: 'sent',
    items: 15,
  },
  {
    id: 'R003',
    number: 3,
    date: new Date('2026-09-09'),
    author: 'Jean Dupont',
    status: 'draft',
    items: 8,
  },
]

export function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showAutoReport, setShowAutoReport] = useState(false)

  if (showAutoReport) {
    return <CRReport number={MOCK_REPORTS.length + 1} onBack={() => setShowAutoReport(false)} />
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Auto-generate CR */}
      <button
        onClick={() => setShowAutoReport(true)}
        style={{ width: '100%', marginBottom: '16px', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #0d3f68, #17679e)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <Sparkles size={17} />
        Générer le CR automatique
      </button>

      {/* Reports List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {MOCK_REPORTS.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#5c6f80',
              fontSize: '13px',
              borderRadius: '6px',
              background: '#f9fbfd',
              border: '1px solid #e3e9ee',
            }}
          >
            Aucun rapport enregistré.
          </div>
        ) : (
          MOCK_REPORTS.map(report => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
              style={{
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e3e9ee',
                background: selectedReport === report.id ? '#eef2f6' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0b3b60', marginBottom: '2px' }}>
                    CR N°{report.number} — {report.date.toLocaleDateString('fr')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#5c6f80' }}>
                    Par {report.author} • {report.items} photos/observations
                  </div>
                </div>
                <div
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '600',
                    background: report.status === 'sent' ? '#dcfce7' : '#fef3c7',
                    color: report.status === 'sent' ? '#15803d' : '#b45309',
                  }}
                >
                  {report.status === 'sent' ? 'Envoyé' : 'Brouillon'}
                </div>
              </div>

              {/* Expanded content */}
              {selectedReport === report.id && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #d1dce5' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        background: '#0b3b60',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Eye size={14} />
                      Consulter
                    </button>
                    <button
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #d1dce5',
                        background: 'white',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Download size={14} />
                      Télécharger
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Report Button */}
      <button
        style={{
          marginTop: '16px',
          width: '100%',
          padding: '12px',
          borderRadius: '6px',
          border: 'none',
          background: '#0b3b60',
          color: 'white',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#0a2a47')}
        onMouseLeave={e => (e.currentTarget.style.background = '#0b3b60')}
      >
        + Nouveau rapport
      </button>
    </div>
  )
}
