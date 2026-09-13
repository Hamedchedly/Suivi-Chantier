import { useState } from 'react'
import { Building2, Check, Pencil, Plus, Trash2, X, Sparkles, RotateCcw, Archive } from 'lucide-react'
import {
  Project, TrashedProject, ProjectInput, PROJECT_ERROR_LABEL, ProjectError,
  createProject, updateProject, projectSubtitle,
} from '../../lib/projects'
import { seedProjectData } from '../../lib/repo'
import { DEMO_PROJECT, buildDemoSeed } from '../../lib/demoData'
import { GAMBETTA_PROJECT, buildGambettaSeed } from '../../lib/gambettaData'
import { User } from '../../lib/auth'

interface Props {
  projects: Project[]
  trash: TrashedProject[]
  currentProjectId: string | null
  currentUser: User
  onChange: (projects: Project[]) => void
  onSwitch: (id: string) => void
  /** Met l'opération à la corbeille (réversible, données conservées). */
  onDelete: (id: string) => void
  /** Restaure une opération depuis la corbeille. */
  onRestore: (id: string) => void
  /** Supprime définitivement une opération de la corbeille (purge les données). */
  onPurge: (id: string) => void
}

const input: React.CSSProperties = {
  width: '100%', padding: '9px 10px', borderRadius: '9px',
  border: '1px solid var(--line)', fontSize: '13px', fontFamily: 'inherit',
}

const label: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px', display: 'block',
}

const EMPTY: ProjectInput = { name: '', reference: '', address: '' }

export function Projets({ projects, trash, currentProjectId, currentUser, onChange, onSwitch, onDelete, onRestore, onPurge }: Props) {
  const [form, setForm] = useState<ProjectInput | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [purgeConfirm, setPurgeConfirm] = useState<string | null>(null)
  const [error, setError] = useState<ProjectError | null>(null)

  const startCreate = () => { setEditing(null); setForm({ ...EMPTY }); setError(null) }
  const startEdit = (p: Project) => {
    setEditing(p.id)
    setForm({ name: p.name, reference: p.reference ?? '', address: p.address ?? '' })
    setError(null)
  }
  const closeForm = () => { setForm(null); setEditing(null); setError(null) }

  const submit = () => {
    if (!form) return
    const res = editing
      ? updateProject(projects, editing, form)
      : createProject(projects, { ...form, createdBy: currentUser.id })
    if (!res.ok) { setError(res.error ?? null); return }
    onChange(res.projects)
    // Une opération qu'on vient de créer devient l'opération courante.
    if (!editing && res.project) onSwitch(res.project.id)
    closeForm()
  }

  const remove = (id: string) => {
    onDelete(id)          // → corbeille (réversible), géré par App
    setConfirm(null)
  }

  // Crée un projet pré-rempli (exemple ou opération réelle), en évitant les
  // doublons de nom, puis bascule dessus.
  const loadPreset = (base: ProjectInput, seed: ReturnType<typeof buildDemoSeed>) => {
    let input = { ...base, createdBy: currentUser.id }
    for (let n = 2; projects.some(p => p.name.toLowerCase() === input.name.toLowerCase()); n++) {
      input = { ...input, name: `${base.name} (${n})` }
    }
    const res = createProject(projects, input)
    if (!res.ok || !res.project) return
    onChange(res.projects)
    seedProjectData(res.project.id, seed)
    onSwitch(res.project.id)
  }
  const loadDemo = () => loadPreset(DEMO_PROJECT, buildDemoSeed())
  const loadGambetta = () => loadPreset(GAMBETTA_PROJECT, buildGambettaSeed())

  return (
    <div style={{ padding: '16px', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--navy)' }}>Mes opérations</h2>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Chaque opération a son propre planning, ses visites, ses réserves et ses finances.
          </div>
        </div>
        {!form && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={loadGambetta} title="Charger l'opération 111 rue Gambetta (planning N17)" style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 13px',
              borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface, #fff)',
              color: 'var(--navy)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>
              <Building2 size={15} /> Gambetta
            </button>
            <button onClick={loadDemo} title="Créer un projet d'exemple pré-rempli" style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 13px',
              borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface, #fff)',
              color: 'var(--navy)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>
              <Sparkles size={15} /> Exemple
            </button>
            <button onClick={startCreate} title="Nouvelle opération" style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 13px',
              borderRadius: '9px', border: 'none', background: 'var(--navy)', color: '#fff',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}>
              <Plus size={15} /> Nouvelle
            </button>
          </div>
        )}
      </div>

      {form && (
        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '14px', marginBottom: '14px', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ flex: 1, fontSize: '14px', color: 'var(--navy)' }}>
              {editing ? "Modifier l'opération" : 'Nouvelle opération'}
            </strong>
            <button onClick={closeForm} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
              <X size={17} />
            </button>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={label}>Nom de l'opération</label>
            <input autoFocus value={form.name} style={input}
              placeholder="Réhabilitation de 7 logements"
              onChange={e => setForm({ ...form, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={label}>Référence (facultatif)</label>
              <input value={form.reference ?? ''} style={input} placeholder="ER.T2286"
                onChange={e => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <label style={label}>Adresse (facultatif)</label>
              <input value={form.address ?? ''} style={input} placeholder="111 Rue Gambetta, 51100 Reims"
                onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: '#b42318', marginBottom: '10px' }}>
              {PROJECT_ERROR_LABEL[error]}
            </div>
          )}

          <button onClick={submit} style={{
            padding: '9px 15px', borderRadius: '9px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          }}>
            {editing ? 'Enregistrer' : "Créer l'opération"}
          </button>
        </div>
      )}

      {projects.length === 0 && !form && (
        <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--muted)', fontSize: '13px', border: '1px dashed var(--line)', borderRadius: '12px' }}>
          Aucune opération pour l'instant.<br />
          Créez la vôtre, ou chargez un projet d'exemple pour découvrir l'application.
          <div style={{ marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={loadDemo} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '9px', border: '1px solid var(--line)', background: '#fff', color: 'var(--navy)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Sparkles size={15} /> Charger un exemple
            </button>
            <button onClick={startCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '9px', border: 'none', background: 'var(--navy)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={15} /> Nouvelle opération
            </button>
          </div>
        </div>
      )}

      {projects.map(p => {
        const active = p.id === currentProjectId
        const sub = projectSubtitle(p)
        return (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: '11px', padding: '12px',
            border: active ? '2px solid var(--accent)' : '1px solid var(--line)',
            borderRadius: '12px', marginBottom: '9px', background: '#fff',
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
              background: 'var(--sky-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Building2 size={18} color="var(--navy)" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--navy)' }}>{p.name}</div>
              {sub && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub}</div>}
              {active && (
                <div style={{ fontSize: '11px', color: 'var(--ok)', fontWeight: 700, marginTop: '2px' }}>
                  <Check size={11} style={{ verticalAlign: '-1px' }} /> Opération affichée
                </div>
              )}
            </div>

            {confirm === p.id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: '#b45309', maxWidth: '140px' }}>
                  Mettre à la corbeille ? Restaurable ensuite.
                </span>
                <button onClick={() => remove(p.id)} style={{
                  padding: '6px 10px', borderRadius: '8px', border: 'none',
                  background: '#b45309', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                }}>Corbeille</button>
                <button onClick={() => setConfirm(null)} style={{
                  padding: '6px 9px', borderRadius: '8px', border: '1px solid var(--line)',
                  background: '#fff', fontSize: '11px', cursor: 'pointer',
                }}>Annuler</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                {!active && (
                  <button onClick={() => onSwitch(p.id)} style={{
                    padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--line)',
                    background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--navy)',
                  }}>Ouvrir</button>
                )}
                <button onClick={() => startEdit(p)} title="Modifier" style={{
                  border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '6px',
                }}><Pencil size={15} /></button>
                <button onClick={() => setConfirm(p.id)} title="Mettre à la corbeille" style={{
                  border: 'none', background: 'none', cursor: 'pointer', color: '#b45309', padding: '6px',
                }}><Trash2 size={15} /></button>
              </div>
            )}
          </div>
        )
      })}

      {trash.length > 0 && (
        <div style={{ marginTop: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>
            <Archive size={13} /> Corbeille ({trash.length})
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
            Les opérations supprimées sont conservées ici avec toutes leurs données. Restaurez-les
            à tout moment, ou supprimez-les définitivement.
          </div>
          {trash.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px',
              border: '1px dashed var(--line)', borderRadius: '12px', marginBottom: '8px', background: '#fbfaf8',
            }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: '#f1ede6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={16} color="#b45309" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--navy)' }}>{t.name}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                  Supprimée le {new Date(t.deletedAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
              {purgeConfirm === t.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: '#b42318', maxWidth: '120px' }}>Supprimer définitivement ?</span>
                  <button onClick={() => { onPurge(t.id); setPurgeConfirm(null) }} style={{
                    padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#b42318', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}>Supprimer</button>
                  <button onClick={() => setPurgeConfirm(null)} style={{
                    padding: '6px 9px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', cursor: 'pointer',
                  }}>Annuler</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <button onClick={() => onRestore(t.id)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '8px',
                    border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--navy)',
                  }}><RotateCcw size={13} /> Restaurer</button>
                  <button onClick={() => setPurgeConfirm(t.id)} title="Supprimer définitivement" style={{
                    border: 'none', background: 'none', cursor: 'pointer', color: '#b42318', padding: '6px',
                  }}><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
