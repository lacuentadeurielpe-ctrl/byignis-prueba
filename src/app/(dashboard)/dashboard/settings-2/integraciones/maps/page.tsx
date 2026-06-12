'use client'

import { useState, useEffect } from 'react'
import { MapPin, AlertCircle, CheckCircle } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import FormSection from '../../components/FormSection'

interface MapsData {
  estado?: 'conectado' | 'desconectado' | 'error'
  metadata?: {
    api_key?: string
  }
}

export default function MapsPage() {
  const [data, setData] = useState<MapsData>({})
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/integraciones/maps')
        if (res.ok) {
          const result = await res.json()
          setData(result)
          if (result.metadata?.api_key) {
            setApiKey(result.metadata.api_key)
          }
        }
      } catch (err) {
        setError('Error al cargar configuración')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleConnect = async () => {
    if (!apiKey) {
      setError('API Key es requerida')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/settings-2/integraciones/maps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      })

      if (res.ok) {
        const result = await res.json()
        setData(result)
        setSuccess('Google Maps conectado')
      } else {
        const err = await res.json()
        setError(err.error || 'Error al conectar')
      }
    } catch (err) {
      setError('Error en la conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Google Maps?')) return

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/integraciones/maps', {
        method: 'DELETE',
      })

      if (res.ok) {
        setData({ estado: 'desconectado' })
        setApiKey('')
        setSuccess('Google Maps desconectado')
      } else {
        setError('Error al desconectar')
      }
    } catch (err) {
      setError('Error en la desconexión')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-zinc-500">Cargando...</div>

  const isConnected = data?.estado === 'conectado'

  return (
    <div>
      <SettingsHeader
        title="Google Maps"
        description="Geocoding y rutas de delivery"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }, { label: 'Google Maps' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <FormSection
          title="Estado de Conexión"
          description="Estado actual de Google Maps API"
          icon={<MapPin className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {isConnected ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-900">Conectado</p>
                    <p className="text-sm text-emerald-700">Google Maps está activo para geocoding y rutas</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Desconectado</p>
                    <p className="text-sm text-amber-700">Conecta Google Maps para optimizar entregas</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection
          title="API Key"
          description="Configura tu clave de API de Google Maps"
          icon={<MapPin className="w-5 h-5" />}
          isDirty={true}
        >
          <div className="space-y-4">
            {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}
            {success && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">{success}</div>}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="AIza..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-xs text-zinc-500 hover:text-zinc-700"
                >
                  {showKey ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Obtén tu API Key desde Google Cloud Console</p>
            </div>

            <div className="flex gap-3 pt-4">
              {isConnected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded border border-rose-200 disabled:opacity-50"
                >
                  {isSaving ? 'Desconectando...' : 'Desconectar'}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isSaving || !apiKey}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
                >
                  {isSaving ? 'Conectando...' : 'Conectar'}
                </button>
              )}
            </div>
          </div>
        </FormSection>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm text-blue-900 font-medium">¿Cómo funciona?</p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>El API key aquí guardado se usa en el bot de WhatsApp y en el motor de delivery para geocodificar direcciones.</li>
            <li>Si ya tienes configurada la variable de entorno <code className="bg-blue-100 px-1 rounded text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> en Vercel, esa tiene prioridad.</li>
            <li>Si no tienes la variable de entorno, el key guardado aquí activa Google Maps automáticamente.</li>
            <li>Sin ninguna clave, el sistema usa OpenStreetMap (Nominatim) como fallback gratuito.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
