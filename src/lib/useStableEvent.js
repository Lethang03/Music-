import { useCallback, useLayoutEffect, useRef } from 'react'

// Stable UI callback identity with the latest controller implementation.
export function useStableEvent(callback) {
  const ref = useRef(callback)
  useLayoutEffect(() => { ref.current = callback }, [callback])
  return useCallback((...args) => ref.current(...args), [])
}
