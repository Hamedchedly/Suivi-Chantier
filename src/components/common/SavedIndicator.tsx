import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

interface Props {
  /** Valeur observée : à chaque changement, l'indicateur « Enregistré » pulse. */
  watch: unknown
  label?: string
}

/**
 * Retour visuel discret pour les écrans à sauvegarde automatique : quand la
 * donnée observée change, on affiche « Enregistré » pendant un court instant.
 * Le tout premier rendu est ignoré (l'ouverture de l'écran n'est pas une
 * sauvegarde).
 */
export function SavedIndicator({ watch, label = 'Enregistré' }: Props) {
  const [visible, setVisible] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    setVisible(true)
    const id = setTimeout(() => setVisible(false), 1400)
    return () => clearTimeout(id)
  }, [watch])

  return (
    <span
      aria-live="polite"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '11px', fontWeight: 700, color: 'var(--ok)',
        opacity: visible ? 1 : 0, transition: 'opacity .2s',
        pointerEvents: 'none',
      }}
    >
      <Check size={13} /> {label}
    </span>
  )
}
