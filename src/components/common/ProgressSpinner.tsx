import { ChevronUp, ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface Props {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  showButtons?: 'compact' | 'full' // compact: ±5% only, full: ±5% and ±10%
}

/**
 * Progress spinner: display current value with ±5%/±10% adjustment buttons.
 * Click the value to manually enter a number.
 */
export function ProgressSpinner({ value, onChange, disabled = false, showButtons = 'full' }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

  const handleAdjust = (delta: number) => {
    if (disabled) return
    onChange(clamp(value + delta))
  }

  const handleEditSubmit = () => {
    const parsed = Math.round(parseFloat(editValue) || 0)
    if (!isNaN(parsed)) {
      onChange(clamp(parsed))
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEditSubmit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
      {showButtons === 'full' && (
        <button
          onClick={() => handleAdjust(-10)}
          disabled={disabled}
          title="-10%"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: disabled ? '#f1f5f9' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: disabled ? '#cbd5e1' : '#64748b',
            opacity: disabled ? 0.5 : 1,
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          -10
        </button>
      )}

      <button
        onClick={() => handleAdjust(-5)}
        disabled={disabled}
        title="-5%"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          background: disabled ? '#f1f5f9' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? '#cbd5e1' : '#64748b',
          opacity: disabled ? 0.5 : 1,
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        <ChevronDown size={16} />
      </button>

      {editing ? (
        <input
          autoFocus
          type="number"
          min={0}
          max={100}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={handleKeyDown}
          style={{
            width: '50px',
            padding: '4px 6px',
            borderRadius: '4px',
            border: '2px solid #0284c7',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 700,
            color: '#0284c7',
          }}
        />
      ) : (
        <button
          onClick={() => {
            setEditing(true)
            setEditValue(value.toString())
          }}
          disabled={disabled}
          title="Cliquer pour saisir manuellement"
          style={{
            padding: '4px 12px',
            borderRadius: '6px',
            border: '2px solid #0284c7',
            background: '#eff6ff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 700,
            color: '#0284c7',
            minWidth: '50px',
            textAlign: 'center',
          }}
        >
          {value}%
        </button>
      )}

      <button
        onClick={() => handleAdjust(5)}
        disabled={disabled}
        title="+5%"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          background: disabled ? '#f1f5f9' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? '#cbd5e1' : '#64748b',
          opacity: disabled ? 0.5 : 1,
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        <ChevronUp size={16} />
      </button>

      {showButtons === 'full' && (
        <button
          onClick={() => handleAdjust(10)}
          disabled={disabled}
          title="+10%"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: disabled ? '#f1f5f9' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: disabled ? '#cbd5e1' : '#64748b',
            opacity: disabled ? 0.5 : 1,
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          +10
        </button>
      )}
    </div>
  )
}
