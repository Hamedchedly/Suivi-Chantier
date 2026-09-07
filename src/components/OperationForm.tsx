import { useState, type FormEvent } from 'react'
import type { OperationForm as OperationValues } from '../lib/types'

type Props = { onSubmit: (values: OperationValues) => Promise<void>; disabled: boolean }

export function OperationForm({ onSubmit, disabled }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), address: address.trim() || null })
      setName('')
      setAddress('')
    } finally { setSaving(false) }
  }

  return <form className="operation-form" onSubmit={submit}>
    <label>Nom de l’opération<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Réhabilitation résidence" /></label>
    <label>Adresse <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Adresse facultative" /></label>
    <button disabled={disabled || saving} type="submit">{saving ? 'Création…' : 'Créer l’opération'}</button>
  </form>
}
