import { useState, useEffect } from 'react'
import { Download, Upload } from 'lucide-react'
import { LotContact, getLotsConfig, saveLotsConfig } from '../../lib/repo'

type ConfigTab = 'project' | 'lots' | 'email' | 'export' | 'backup'

interface ProjectConfig {
  name: string
  address: string
  moa: string
  moe: string
  amo: string
}

const MOCK_PROJECT: ProjectConfig = {
  name: 'Gambetta — Réhabilitation',
  address: '111 Rue Gambetta, 51100 Reims',
  moa: 'Ville de Reims',
  moe: 'Bureau d\'Études ABC',
  amo: 'Consultant Projet XYZ',
}

export function Config() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('project')
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(MOCK_PROJECT)
  const [lots, setLots] = useState<LotContact[]>(getLotsConfig)

  useEffect(() => {
    saveLotsConfig(lots)
  }, [lots])

  const updateLot = (id: string, field: keyof LotContact, value: string) => {
    setLots(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)))
  }

  const tabs: { id: ConfigTab; label: string }[] = [
    { id: 'project', label: 'Projet' },
    { id: 'lots', label: 'Lots & contacts' },
    { id: 'email', label: 'Modèle mail' },
    { id: 'export', label: 'Export' },
    { id: 'backup', label: 'Backup' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#f3f6f9' }}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid #e3e9ee',
          background: 'white',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#0b3b60' : '#5c6f80',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '600' : '500',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #0b3b60' : '2px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 12px', paddingBottom: '80px' }}>
        {/* Project Tab */}
        {activeTab === 'project' && (
          <div style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '6px' }}>
                Nom de l'opération
              </label>
              <input
                type="text"
                value={projectConfig.name}
                onChange={e => setProjectConfig({ ...projectConfig, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1dce5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '6px' }}>
                Adresse
              </label>
              <input
                type="text"
                value={projectConfig.address}
                onChange={e => setProjectConfig({ ...projectConfig, address: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1dce5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '6px' }}>
                Maître d'ouvrage (MOA)
              </label>
              <input
                type="text"
                value={projectConfig.moa}
                onChange={e => setProjectConfig({ ...projectConfig, moa: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1dce5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '6px' }}>
                Maître d'œuvre (MOE)
              </label>
              <input
                type="text"
                value={projectConfig.moe}
                onChange={e => setProjectConfig({ ...projectConfig, moe: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1dce5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '6px' }}>
                AMO
              </label>
              <input
                type="text"
                value={projectConfig.amo}
                onChange={e => setProjectConfig({ ...projectConfig, amo: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1dce5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: 'none',
                background: '#0b3b60',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '12px',
              }}
            >
              Enregistrer
            </button>
          </div>
        )}

        {/* Lots Tab */}
        {activeTab === 'lots' && (
          <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lots.map(lot => (
              <div key={lot.id} style={{ border: '1px solid #e3e9ee', borderRadius: '10px', padding: '12px', background: '#fff' }}>
                <div style={{ fontWeight: '600', color: '#0b3b60', fontSize: '13px', marginBottom: '10px' }}>{lot.name}</div>
                <LotField label="Entreprise" value={lot.company} onChange={v => updateLot(lot.id, 'company', v)} />
                <LotField label="Contact" value={lot.contactName} onChange={v => updateLot(lot.id, 'contactName', v)} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <LotField label="Email" value={lot.email} onChange={v => updateLot(lot.id, 'email', v)} type="email" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <LotField label="Téléphone" value={lot.phone} onChange={v => updateLot(lot.id, 'phone', v)} type="tel" />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: '#5c6f80' }}>
              Les modifications sont enregistrées automatiquement.
            </div>
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div style={{ maxWidth: '600px' }}>
            <p style={{ fontSize: '11px', color: '#5c6f80', marginBottom: '12px' }}>
              Variables: <code style={{ background: '#eef2f6', padding: '2px 6px', borderRadius: '3px' }}>numero</code>{' '}
              <code style={{ background: '#eef2f6', padding: '2px 6px', borderRadius: '3px' }}>operation</code>{' '}
              <code style={{ background: '#eef2f6', padding: '2px 6px', borderRadius: '3px' }}>date</code>
            </p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '6px' }}>
                Sujet
              </label>
              <input
                type="text"
                placeholder="CR N°{{numero}} — {{operation}} — {{date}}"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1dce5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '6px' }}>
                Corps du message
              </label>
              <textarea
                placeholder="Entrez le contenu du message..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1dce5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  minHeight: '120px',
                }}
              />
            </div>
            <button
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: 'none',
                background: '#0b3b60',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Enregistrer le modèle
            </button>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div>
            <p style={{ color: '#5c6f80', fontSize: '13px' }}>Sélectionner le contenu à exporter en développement.</p>
          </div>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                border: 'none',
                background: '#0b3b60',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Download size={16} />
              Exporter backup JSON
            </button>
            <button
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #d1dce5',
                background: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Upload size={16} />
              Importer un backup
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function LotField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <label style={{ fontSize: '10px', fontWeight: '600', color: '#5c6f80', display: 'block', marginBottom: '4px' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1dce5', fontSize: '13px', boxSizing: 'border-box' }}
      />
    </div>
  )
}
