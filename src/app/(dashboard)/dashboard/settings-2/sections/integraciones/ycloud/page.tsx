'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, AlertCircle, CheckCircle } from 'lucide-react'
import SettingsHeader from '../../../components/SettingsHeader'
import FormSection from '../../../components/FormSection'
import IntegrationStatusBadge from '../components/IntegrationStatusBadge'

interface YCloudData {
  estado?: 'conectado' | 'desconectado' | 'error'
  metadata?: {
    api_key?: string
    webhook_secret?: string
    telefono_whatsapp?: string
  }
}

export default function YCloudPage() {
  const [data, setData] = useState<YCloudData>({})
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/integraciones/ycloud')
        if (res.ok) {
          const result = await res.json()
          setData(result)
          if (result.metadata?.api_key) {
            setApiKey(result.metadata.api_key)
            setWebhookSecret(result.metadata.webhook_secret || '')
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
      const res = await fetch('/api/settings-2/integraciones/ycloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          webhook_secret: webhookSecret,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        setData(result)
        setSuccess('YCloud conectado exitosamente')
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
    if (!confirm('¿Desconectar YCloud?')) return

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/integraciones/ycloud', {
        method: 'DELETE',
      })

      if (res.ok) {
        setData({ estado: 'desconectado' })
        setApiKey('')
        setWebhookSecret('')
        setSuccess('YCloud desconectado')
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
        title="YCloud"
        description="API WhatsApp para mensajes bidireccionales"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }, { label: 'YCloud' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <FormSection
          title="Estado de Conexión"
          description="Estado actual de la integración YCloud"
          icon={<MessageCircle className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {isConnected ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-900">Conectado</p>
                    <p className="text-sm text-emerald-700">YCloud está activo y funcionando</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Desconectado</p>
                    <p className="text-sm text-amber-700">Conecta YCloud para habilitar mensajes WhatsApp</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Credenciales"
          description="Configura tus claves de API de YCloud"
          icon={<MessageCircle className="w-5 h-5" />}
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
                  placeholder="sk_live_..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-xs text-zinc-500 hover:text-zinc-700"
                >
                  {showKey ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Obtén tu API Key desde el panel de YCloud</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Webhook Secret (opcional)</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="webhook_secret_..."
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2.5 text-xs text-zinc-500 hover:text-zinc-700"
                >
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            ℹ️ <strong>Información:</strong> YCloud debe estar correctamente configurado para que el bot responda a mensajes WhatsApp.
          </p>
        </div>
      </div>
    </div>
  )
}
