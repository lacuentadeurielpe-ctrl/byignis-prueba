'use client'

import { useState, useEffect } from 'react'
import { FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import FormSection from '../../components/FormSection'
import ToolsEnabledSection from '../components/ToolsEnabledSection'

interface NubefactData {
  estado?: 'conectado' | 'desconectado' | 'pruebas' | 'error'
  metadata?: {
    token?: string
    modo?: 'prueba' | 'produccion'
    url_ruta?: string
  }
}

export default function NubefactPage() {
  const [data, setData] = useState<NubefactData>({})
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [modo, setModo] = useState<'prueba' | 'produccion'>('prueba')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/integraciones/nubefact')
        if (res.ok) {
          const result = await res.json()
          setData(result)
          if (result.metadata?.token) {
            setToken(result.metadata.token)
            setModo(result.metadata.modo || 'prueba')
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
    if (!token) {
      setError('Token es requerido')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/settings-2/integraciones/nubefact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, modo }),
      })

      if (res.ok) {
        const result = await res.json()
        setData(result)
        setSuccess(`Nubefact conectado en modo ${modo}`)
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

  const handleTest = async () => {
    setIsTesting(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/settings-2/integraciones/nubefact/test', { method: 'POST' })
      const json = await res.json()
      if (res.ok) setSuccess(json.message ?? 'Token válido')
      else setError(json.error ?? 'Error al verificar token')
    } catch { setError('Error de conexión') }
    finally { setIsTesting(false) }
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Nubefact?')) return

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/integraciones/nubefact', {
        method: 'DELETE',
      })

      if (res.ok) {
        setData({ estado: 'desconectado' })
        setToken('')
        setSuccess('Nubefact desconectado')
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
  const isTestMode = data?.estado === 'pruebas'

  return (
    <div>
      <SettingsHeader
        title="Nubefact"
        description="Facturación electrónica SUNAT"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }, { label: 'Nubefact' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <FormSection
          title="Estado de Conexión"
          description="Estado actual de la integración Nubefact"
          icon={<FileText className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {isConnected ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-900">Conectado (Producción)</p>
                    <p className="text-sm text-emerald-700">Nubefact está activo en producción</p>
                  </div>
                </div>
              </div>
            ) : isTestMode ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">En Pruebas</p>
                    <p className="text-sm text-blue-700">Nubefact está en modo sandbox</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Desconectado</p>
                    <p className="text-sm text-amber-700">Conecta Nubefact para emitir comprobantes</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Credenciales"
          description="Configura tu token de Nubefact"
          icon={<FileText className="w-5 h-5" />}
          isDirty={true}
        >
          <div className="space-y-4">
            {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}
            {success && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">{success}</div>}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Token API</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="tutoken..."
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-2.5 text-xs text-zinc-500 hover:text-zinc-700"
                >
                  {showToken ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Obtén tu token desde tu panel de Nubefact</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Modo</label>
              <select
                value={modo}
                onChange={e => setModo(e.target.value as 'prueba' | 'produccion')}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="prueba">Pruebas (Sandbox)</option>
                <option value="produccion">Producción</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">Usa Pruebas para testear, Producción para facturación real</p>
            </div>

            <div className="flex gap-3 pt-4">
              {isConnected || isTestMode ? (
                <>
                  <button
                    onClick={handleTest}
                    disabled={isTesting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded disabled:opacity-50"
                  >
                    {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isTesting ? 'Verificando...' : 'Probar token'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded border border-rose-200 disabled:opacity-50"
                  >
                    {isSaving ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isSaving || !token}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
                >
                  {isSaving ? 'Conectando...' : 'Conectar'}
                </button>
              )}
            </div>
          </div>
        </FormSection>

        {/* Herramientas que activa */}
        <ToolsEnabledSection integracionId="nubefact" isConnected={isConnected || isTestMode} />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            ℹ️ <strong>Importante:</strong> Empieza en modo Pruebas para verificar el flujo. Cambia a Producción solo cuando estés listo para emitir comprobantes reales ante SUNAT.
          </p>
        </div>
      </div>
    </div>
  )
}
