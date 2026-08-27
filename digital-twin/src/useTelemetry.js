import { useEffect, useRef, useCallback } from 'react'

const TWIN_API_URL = import.meta.env.VITE_TWIN_API_URL || 'http://localhost:3030/api/twin/current'

export function useTelemetry(onUpdate) {
  const prevRef = useRef('[]')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(TWIN_API_URL)
      const data = await res.json()
      if (!Array.isArray(data)) return

      const serialized = JSON.stringify(data)
      if (prevRef.current !== serialized) {
        prevRef.current = serialized
        onUpdate(data)
      }
    } catch (e) {
      console.error('Telemetry fetch error:', e)
    }
  }, [onUpdate])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 2000)
    return () => clearInterval(id)
  }, [fetchData])
}
