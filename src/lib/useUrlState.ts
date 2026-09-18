import { useEffect } from 'react'

/**
 * Hook for bidirectional URL ↔ state synchronization.
 * Updates URL when state changes, restores state from URL on mount.
 * Uses replaceState to keep history clean.
 *
 * @param state Current state value
 * @param setState Function to update state
 * @param paramName Name of the URL query parameter
 * @param encode Optional encoder function (default: encodeURIComponent)
 * @param decode Optional decoder function (default: decodeURIComponent)
 */
export function useUrlState(
  state: string | null,
  setState: (value: string | null) => void,
  paramName: string,
  encode?: (v: string) => string,
  decode?: (v: string) => string
) {
  const enc = encode || encodeURIComponent
  const dec = decode || decodeURIComponent

  // Read from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const value = params.get(paramName)
    if (value) {
      try {
        setState(dec(value))
      } catch {
        // Silently ignore decode errors
      }
    }
  }, [])

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (state) {
      params.set(paramName, enc(state))
    } else {
      params.delete(paramName)
    }
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }, [state])
}

/**
 * Hook for multiple URL states (multiple params at once).
 * Useful for syncing several related values to the URL.
 *
 * @param states Object mapping paramName → state value
 * @param setStates Function to update multiple states at once
 */
export function useUrlStates(
  states: Record<string, string | null>,
  setStates: (updates: Record<string, string | null>) => void
) {
  // Read all params from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const updates: Record<string, string | null> = {}
    let hasChanges = false
    for (const key of Object.keys(states)) {
      const value = params.get(key)
      if (value) {
        try {
          updates[key] = decodeURIComponent(value)
          hasChanges = true
        } catch {
          // Silently ignore decode errors
        }
      }
    }
    if (hasChanges) setStates(updates)
  }, [])

  // Update URL when any state changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(states)) {
      if (value) {
        params.set(key, encodeURIComponent(value))
      } else {
        params.delete(key)
      }
    }
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }, [states])
}
