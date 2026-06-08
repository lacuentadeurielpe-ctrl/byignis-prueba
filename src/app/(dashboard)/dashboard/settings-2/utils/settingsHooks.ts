import { useState, useCallback } from 'react'

export function useSettingsSave() {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(async (data: Record<string, any>, endpoint: string) => {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }

      return await res.json()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { save, isSaving, error }
}

export function useIntegrationStatus() {
  const [status, setStatus] = useState<'conectado' | 'error' | 'expirado' | 'desconectado' | 'pendiente'>('pendiente')
  const [loading, setLoading] = useState(false)

  const fetchStatus = useCallback(async (endpoint: string) => {
    setLoading(true)
    try {
      const res = await fetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        setStatus(data.estado || 'desconectado')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { status, loading, fetchStatus }
}
