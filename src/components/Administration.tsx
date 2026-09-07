import { useEffect, useState, type FormEvent } from 'react'
import { addCompany, addLot, addTask, addUnit, listTasks, moveTask, setAssignment } from '../lib/data'
import { parsePaste, type PasteTaskRow } from '../lib/paste'
import type { Company, Lot, Task, Unit, UnitKind } from '../lib/types'

type Props = {
  operationId: string
  units: Unit[]
  lots: Lot[]
  companies: Company[]
  assignments: { lot_id: string; unit_id: string | null; scope: string }[]
  reload: () => Promise<void>
}

const UNIT_KINDS: { value: UnitKind; label: string }[] = [
  { value: 'building', label: 'Bâtiment' },
  { value: 'dwelling', label: 'Logement' },
{ value: 'common_area', label: 'Partie commune' },
{ value: 'exterior', label: 'Extérieur' },
{ value: 'zone', label: 'Zone' }
]

const unitLabel = (kind: UnitKind): string =>
  UNIT_KINDS.find((entry) => entry.value === kind)?.label ?? kind

export function Administration({ operationId, units, lots, companies, assignments, reload }: Props) {
  const [kind, setKind] = useState<UnitKind>('building')
  const [message, setMessage] = useState<string | null>(null)
const [selectedLotId, setSelectedLotId] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
const [sectionName, setSectionName] = useState('')
  const [itemFields, setItemFields] = useState({ name: '', reference: '', unit: '', quantity: '', unit_price: '', amount: '', parent_id: '' })
const [pasteText, setPasteText] = useState('')
  const [pastePreview, setPastePreview] = useState<PasteTaskRow[] | null>(null)
const [busy, setBusy] = useState(false)

  const loadTasks = async (lotId: string) => {
    if (!lotId) { setTasks([]); return }
    setTasks(await listTasks(operationId, lotId))
  }

  useEffect(() => {
    void loadTasks(selectedLotId).catch((error: Error) => setMessage(error.message))
  }, [selectedLotId])

  const submit = (action: () => Promise<void>) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await action(); await reload(); setMessage('Enregistré.') ; event.currentTarget.reset() } catch (error) { setMessage(error instanceof Error ? error.message : 'Erreur.') }
  }

  const parentOptions = (targetKind: UnitKind): Unit[] => {
    if (targetKind === 'dwelling') return units.filter((unit) => unit.kind === 'building')
    if (targetKind === 'zone') return units.filter((unit) => unit.kind === 'building' || unit.kind === 'zone' || unit.kind === 'common_area' || unit.kind === 'exterior')
    return []
  }

  const dwellings = units.filter((unit) => unit.kind === 'dwelling')
  const sections = tasks.filter((task) => task.task_type === 'section')
  const treeItems = tasks.map((task) => ({ task, depth: depthOf(task.id, tasks) }))

  const addSection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedLotId || !sectionName.trim()) return
    await addTask(operationId, selectedLotId, { task_type: 'section', name: sectionName.trim(), reference: null, sort_order: tasks.length })
    setSectionName('')
    await loadTasks(selectedLotId)
    setMessage('Section ajoutée.')
  }

  const addItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedLotId || !itemFields.name.trim()) return
    await addTask(operationId, selectedLotId, {
      task_type: 'item',
      name: itemFields.name.trim(),
      reference: itemFields.reference.trim() || null,
      unit: itemFields.unit.trim() || null,
      quantity: itemFields.quantity.trim() ? Number(itemFields.quantity.trim()) : null,
      unit_price: itemFields.unit_price.trim() ? Number(itemFields.unit_price.trim()) : null,
      amount: itemFields.amount.trim() ? Number(itemFields.amount.trim()) : null,
      parent_id: itemFields.parent_id || null,
      sort_order: tasks.length
    })
    setItemFields({ name: '', reference: '', unit: '', quantity: '', unit_price: '', amount: '', parent_id: '' })
    await loadTasks(selectedLotId)
    setMessage('Tâche ajoutée.')
  }

  const reorder = async (taskId: string, direction: -1 | 1) => {
    await moveTask(operationId, taskId, direction, tasks)
    await loadTasks(selectedLotId)
  }

  const previewPaste = () => {
    const rows = parsePaste(pasteText)
    setPastePreview(rows)
    setMessage(`${rows.length} ligne(s) prêtes à valider.`)
  }

const validatePaste = async () => {
    if (!selectedLotId || !pastePreview?.length) return
    setBusy(true)
    try {
      let lastSectionId: string | null = null
      let sections = 0
      let items = 0
      for (const [index, row] of pastePreview.entries()) {
        if (row.kind === 'section') {
          const created = await addTask(operationId, selectedLotId, { task_type: 'section', name: row.designation, reference: row.reference || null, sort_order: tasks.length + index })
          lastSectionId = created.id
          sections++
        } else {
          await addTask(operationId, selectedLotId, {
            task_type: 'item',
            name: row.designation,
            reference: row.reference || null,
            unit: row.unit || null,
            quantity: row.quantity ? Number(row.quantity) : null,
            unit_price: row.unit_price ? Number(row.unit_price) : null,
            amount: row.amount ? Number(row.amount) : null,
            parent_id: lastSectionId,
            sort_order: tasks.length + index
          })
          items++
        }
      }
      setPasteText('')
      setPastePreview(null)
      await loadTasks(selectedLotId)
      setMessage(`Collage validé : ${sections} section(s), ${items} tâche(s).`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Collage impossible.')
    } finally { setBusy(false) }
  }

  return (
    <section className="stack">
      <h2>Administration</h2>
      {message && <p className="notice">{message}</p>}

      <details open>
        <summary>Sites et localisations</summary>
        <form onSubmit={submit(async () => { const form = new FormData(document.querySelector('#unit-form') as HTMLFormElement); await addUnit(operationId, { kind, code: String(form.get('code') || '') || null, name: String(form.get('name')), floor: String(form.get('floor') || '') || null, parent_id: String(form.get('parent') || '') || null, sort_order: Number(form.get('order') || 0) }) })} id="unit-form" className="form-grid">
          <select value={kind} onChange={(event) => setKind(event.target.value as UnitKind)}>{UNIT_KINDS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
          <input name="code" placeholder="Code / numéro"/>
          <input required name="name" placeholder="Nom"/>
          <input name="floor" placeholder="Étage"/>
          <select name="parent"><option value="">Sans parent</option>{parentOptions(kind).map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit.kind)} · {unit.code ?? ''} {unit.name}</option>)}</select>
          <input name="order" type="number" placeholder="Ordre"/>
          <button>Ajouter</button>
        </form>
        <List title="Éléments configurés" items={units.map((unit) => `${unitLabel(unit.kind)} · ${unit.code ?? ''} ${unit.name}${unit.parent_id ? ' (rattaché)' : ''}`)} />
      </details>

      <details>
        <summary>Entreprises</summary>
        <form onSubmit={submit(async () => { const f = new FormData(document.querySelector('#company-form') as HTMLFormElement); await addCompany(operationId, { name: String(f.get('name')), contact_name: String(f.get('contact') || '') || null, email: String(f.get('email') || '') || null, phone: String(f.get('phone') || '') || null }) })} id="company-form" className="form-grid">
          <input required name="name" placeholder="Entreprise"/>
          <input name="contact" placeholder="Contact"/>
          <input name="email" type="email" placeholder="E-mail"/>
          <input name="phone" placeholder="Téléphone"/>
          <button>Ajouter</button>
        </form>
        <List title="Entreprises" items={companies.map((company) => `${company.name}${company.contact_name ? ` · ${company.contact_name}` : ''}`)} />
      </details>

      <details>
        <summary>Lots</summary>
        <form onSubmit={submit(async () => { const f = new FormData(document.querySelector('#lot-form') as HTMLFormElement); await addLot(operationId, { number: String(f.get('number') || '') || null, name: String(f.get('name')), company_id: String(f.get('company') || '') || null, sort_order: Number(f.get('order') || 0) }) })} id="lot-form" className="form-grid">
          <input name="number" placeholder="Numéro"/>
          <input required name="name" placeholder="Intitulé"/>
          <select name="company"><option value="">Sans entreprise</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select>
          <input name="order" type="number" placeholder="Ordre"/>
          <button>Ajouter</button>
        </form>
      </details>

      <details>
        <summary>Bâtiment → logements → lots</summary>
        {dwellings.length === 0 ? <p>Créez d’abord les bâtiments et logements.</p> : dwellings.map((dwelling) => (
          <fieldset key={dwelling.id}><legend>{dwelling.code ?? dwelling.name}</legend>{lots.map((lot) => {
            const checked = assignments.some((assignment) => assignment.lot_id === lot.id && assignment.unit_id === dwelling.id)
            return <label className="check" key={lot.id}><input type="checkbox" checked={checked} onChange={async (event) => { await setAssignment(operationId, lot.id, dwelling.id, 'dwelling', event.target.checked); await reload() }}/>{lot.number ?? lot.code} {lot.name}</label>
          })}</fieldset>
        ))}
      </details>

      <details open>
        <summary>Tâches DPGF</summary>
        <div className="form-grid">
          <label>Lot<select value={selectedLotId} onChange={(event) => setSelectedLotId(event.target.value)}><option value="">Sélectionner un lot</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.number ?? lot.code ?? ''} — {lot.name}</option>)}</select></label>
        </div>

        {selectedLotId && (
          <>
            <div className="tree">
              {tasks.length === 0 && <p>Aucune tâche. Ajoutez une section ou collez depuis Excel.</p>}
              {treeItems.map((entry) => (
                <div key={entry.task.id} className="task-row" style={{ paddingLeft: `${entry.depth}em` }}>
                  <span>{entry.task.task_type === 'section' ? '▸' : '•'}</span>
                  <span>{entry.task.name}{entry.task.reference ? ` (${entry.task.reference})` : ''}{entry.task.quantity ? ` — ${entry.task.quantity} ${entry.task.unit ?? ''}` : ''}</span>
                  <button type="button" onClick={() => void reorder(entry.task.id, -1)}>↑</button>
                  <button type="button" onClick={() => void reorder(entry.task.id, 1)}>↓</button>
                </div>
              ))}
            </div>

            <form onSubmit={addSection} className="form-grid">
              <input required value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder="Intitulé de la section (titre, chapitre…)"/>
              <button>+ Ajouter section</button>
            </form>

            <form onSubmit={addItem} className="form-grid">
              <input required value={itemFields.name} onChange={(event) => setItemFields({ ...itemFields, name: event.target.value })} placeholder="Désignation"/>
              <input value={itemFields.reference} onChange={(event) => setItemFields({ ...itemFields, reference: event.target.value })} placeholder="Référence"/>
              <input value={itemFields.unit} onChange={(event) => setItemFields({ ...itemFields, unit: event.target.value })} placeholder="Unité"/>
              <input value={itemFields.quantity} onChange={(event) => setItemFields({ ...itemFields, quantity: event.target.value })} placeholder="Quantité"/>
              <input value={itemFields.unit_price} onChange={(event) => setItemFields({ ...itemFields, unit_price: event.target.value })} placeholder="P.U."/>
              <input value={itemFields.amount} onChange={(event) => setItemFields({ ...itemFields, amount: event.target.value })} placeholder="Montant"/>
              <select value={itemFields.parent_id} onChange={(event) => setItemFields({ ...itemFields, parent_id: event.target.value })}><option value="">Sous le lot</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select>
              <button>+ Ajouter tâche</button>
            </form>

            <div>
              <h3>Coller depuis Excel</h3>
              <p>Colonnes séparées par tabulations : Désignation, Référence, Unité, Quantité, P.U., Montant. Les lignes TOTAL sont ignorées.</p>
              <textarea value={pasteText} onChange={(event) => { setPasteText(event.target.value); setPastePreview(null) }} rows={6} placeholder="Collez ici vos lignes…"/>
              <div className="actions">
                <button type="button" onClick={previewPaste}>Prévisualiser</button>
                <button type="button" disabled={busy || !pastePreview?.length} onClick={() => void validatePaste()}>{busy ? 'Validation…' : 'Valider le collage'}</button>
              </div>
              {pastePreview && (
                <table className="preview">
                  <thead><tr><th>Type</th><th>Désignation</th><th>Référence</th><th>U</th><th>Qté</th><th>P.U.</th><th>Montant</th></tr></thead>
                  <tbody>
                    {pastePreview.map((row, index) => (
                      <tr key={`${index}-${row.designation}`}><td>{row.kind === 'section' ? 'Section' : 'Tâche'}</td><td>{row.designation}</td><td>{row.reference}</td><td>{row.unit}</td><td>{row.quantity}</td><td>{row.unit_price}</td><td>{row.amount}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </details>
    </section>
  )
}

function depthOf(taskId: string, tasks: Task[]): number {
  let depth = 0
  let current = tasks.find((task) => task.id === taskId)
  while (current?.parent_id) {
    depth++
    current = tasks.find((task) => task.id === current?.parent_id)
  }
  return depth
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>Aucun élément.</p>}
    </div>
  )
}