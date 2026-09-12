import { useState, useEffect } from 'react'
import { Download, Upload, Plus, Trash2 } from 'lucide-react'
import { LotContact, getLotsConfig, saveLotsConfig } from '../../lib/repo'
import { PlanningConfig } from './PlanningConfig'
import { Project, updateProject } from '../../lib/projects'
import { SavedIndicator } from '../common/SavedIndicator'

type ConfigTab = 'project' | 'planning' | 'lots' | 'email' | 'export' | 'backup'

interface ConfigProps {
  /** Opération affichée — null tant qu'aucune n'est ouverte. */
  project: Project | null
  projects: Project[]
  onProjectChange: (projects: Project[]) => void
}

export function Config({ project, projects, onProjectChange }: ConfigProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('project')
  const [lots, setLots] = useState<LotContact[]>(getLotsConfig)

  useEffect(() => {
    saveLotsConfig(lots)
  }, [lots])

  const updateLot = (id: string, field: keyof LotContact, value: string) => {
    setLots(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)))
  }
  const addLot = () => {
    // Code lisible et unique : LOT01, LOT02… en comblant les trous.
    let n = 1
    const codes = new Set(lots.map(l => l.id))
    while (codes.has(`LOT${String(n).padStart(2, '0')}`)) n++
    const id = `LOT${String(n).padStart(2, '0')}`
    setLots(prev => [...prev, { id, name: `Lot ${String(n).padStart(2, '0')}`, company: '', contactName: '', email: '', phone: '' }])
  }
  const removeLot = (id: string) => setLots(prev => prev.filter(l => l.id !== id))

  /** Écrit directement dans le registre des opérations : la saisie est persistée. */
  const patchProject = (field: 'name' | 'address' | 'moa' | 'moe' | 'amo', value: string) => {
    if (!project) return
    const res = updateProject(projects, project.id, { [field]: value })
    if (res.ok) onProjectChange(res.projects)
  }
  const projectConfig = {
    name: project?.name ?? '',
    address: project?.address ?? '',
    moa: project?.moa ?? '',
    moe: project?.moe ?? '',
    amo: project?.amo ?? '',
  }

  const tabs: { id: ConfigTab; label: string }[] = [
    { id: 'project', label: 'Projet' },
    { id: 'planning', label: 'Planning & congés' },
    { id: 'lots', label: 'Lots & contacts' },
    { id: 'email', label: 'Modèle mail' },
    { id: 'export', label: 'Export' },
    { id: 'backup', label: 'Backup' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#f1f5f9' }}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid #e4ecf2',
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
              color: activeTab === tab.id ? '#02457A' : '#5b7183',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '600' : '500',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #02457A' : '2px solid transparent',
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
        {activeTab === 'project' && !project && (
          <div style={{ maxWidth: '600px', color: '#5b7183', fontSize: '13px' }}>
            Aucune opération n'est ouverte. Créez-en une depuis « Mes opérations »
            (icône de compte, en haut à droite).
          </div>
        )}
        {activeTab === 'project' && project && (
          <div style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '6px' }}>
                Nom de l'opération
              </label>
              <input
                type="text"
                value={projectConfig.name}
                onChange={e => patchProject('name', e.target.value)}
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '6px' }}>
                Adresse
              </label>
              <input
                type="text"
                value={projectConfig.address}
                onChange={e => patchProject('address', e.target.value)}
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '6px' }}>
                Maître d'ouvrage (MOA)
              </label>
              <input
                type="text"
                value={projectConfig.moa}
                onChange={e => patchProject('moa', e.target.value)}
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '6px' }}>
                Maître d'œuvre (MOE)
              </label>
              <input
                type="text"
                value={projectConfig.moe}
                onChange={e => patchProject('moe', e.target.value)}
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '6px' }}>
                AMO
              </label>
              <input
                type="text"
                value={projectConfig.amo}
                onChange={e => patchProject('amo', e.target.value)}
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

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#5b7183' }}>
              Les modifications sont enregistrées au fil de la saisie.
              <SavedIndicator watch={project} />
            </div>
          </div>
        )}

        {/* Planning & holidays Tab */}
        {activeTab === 'planning' && <PlanningConfig />}

        {/* Lots Tab */}
        {activeTab === 'lots' && (
          <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '12px', color: '#5b7183', margin: 0 }}>
                Les lots et leurs entreprises alimentent les réserves, la vue Entreprises et les finances.
              </p>
              <button onClick={addLot} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', border: 'none', background: '#02457A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={15} /> Ajouter un lot
              </button>
            </div>

            {lots.length === 0 && (
              <div style={{ fontSize: '12px', color: '#5b7183', padding: '18px', border: '1px dashed #d1dce5', borderRadius: '10px' }}>
                Aucun lot. Ajoutez un lot et son entreprise pour commencer.
              </div>
            )}

            {lots.map(lot => (
              <div key={lot.id} style={{ border: '1px solid #e4ecf2', borderRadius: '10px', padding: '12px', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#018ABE', background: '#D6E8EE', borderRadius: '6px', padding: '3px 7px' }}>{lot.id}</span>
                  <div style={{ flex: 1 }}>
                    <LotField label="Libellé du lot" value={lot.name} onChange={v => updateLot(lot.id, 'name', v)} />
                  </div>
                  <button onClick={() => removeLot(lot.id)} title="Supprimer le lot" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b42318', padding: '4px', alignSelf: 'flex-start', marginTop: '18px' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
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
            {lots.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5b7183' }}>
                Les modifications sont enregistrées automatiquement.
                <SavedIndicator watch={lots} />
              </div>
            )}
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div style={{ maxWidth: '600px' }}>
            <p style={{ fontSize: '11px', color: '#5b7183', marginBottom: '12px' }}>
              Variables: <code style={{ background: '#eef2f6', padding: '2px 6px', borderRadius: '3px' }}>numero</code>{' '}
              <code style={{ background: '#eef2f6', padding: '2px 6px', borderRadius: '3px' }}>operation</code>{' '}
              <code style={{ background: '#eef2f6', padding: '2px 6px', borderRadius: '3px' }}>date</code>
            </p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '6px' }}>
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '6px' }}>
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
                background: '#02457A',
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
            <p style={{ color: '#5b7183', fontSize: '13px' }}>Sélectionner le contenu à exporter en développement.</p>
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
                background: '#02457A',
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
      <label style={{ fontSize: '10px', fontWeight: '600', color: '#5b7183', display: 'block', marginBottom: '4px' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1dce5', fontSize: '13px', boxSizing: 'border-box' }}
      />
    </div>
  )
}
