'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Banknote, AlertCircle, CheckCircle, Key } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import FormSection from '../../components/FormSection'

interface MPData {
  estado?: 'conectado' | 'desconectado' | 'error'
  metadata?: {
    email?: string
    user_id?: string
  }
}

function MercadoPagoContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<MPData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    const urlError = searchParams.get('error')
    const urlMsg = searchParams.get('msg')
    if (urlError) {
      setError(urlMsg || 'Error en la conexión con Mercado Pago')
      setShowManual(true)
    }

    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/integraciones/mercadopago')
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch {
        setError('Error al cargar configuración')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [searchParams])

  const handleSaveManual = async () => {
    if (!accessToken.trim()) {
      setError('El access token es requerido')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings-2/integraciones/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken.trim(),
          public_key: publicKey.trim() || null,
        }),
      })
      if (res.ok) {
        const result = await res.json()
        setData(result)
        setAccessToken('')
        setPublicKey('')
        setShowManual(false)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al guardar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Mercado Pago?')) return
    setIsSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings-2/integraciones/mercadopago', { method: 'DELETE' })
      if (res.ok) {
        setData({ estado: 'desconectado' })
      } else {
        setError('Error al desconectar')
      }
    } catch {
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
        title="Mercado Pago"
        description="Pagos y recaudación en línea"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }, { label: 'Mercado Pago' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <FormSection
          title="Estado de Conexión"
          description="Conecta tu cuenta de Mercado Pago"
          icon={<Banknote className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {isConnected ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-900">Conectado</p>
                    {data.metadata?.email && (
                      <p className="text-sm text-emerald-700">Cuenta: {data.metadata.email}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Desconectado</p>
                    <p className="text-sm text-amber-700">Conecta Mercado Pago para recibir pagos en línea</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
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
                  onClick={() => setShowManual(v => !v)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                >
                  <Key className="w-4 h-4" />
                  Ingresar Access Token
                </button>
              )}
            </div>
          </div>
        </FormSection>

        {(!isConnected && showManual) && (
          <FormSection
            title="Conexión manual con Access Token"
            description="Obtén tu access token desde el panel de desarrolladores de Mercado Pago"
            icon={<Key className="w-5 h-5" />}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Access Token <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  placeholder="APP_USR-..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Mercado Pago → Tu negocio → Credenciales → Producción → Access Token
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Public Key <span className="text-zinc-400 text-xs">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={e => setPublicKey(e.target.value)}
                  placeholder="APP_USR-..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleSaveManual}
                disabled={isSaving || !accessToken.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded"
              >
                {isSaving ? 'Guardando...' : 'Guardar token'}
              </button>
            </div>
          </FormSection>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            ℹ️ <strong>Nota:</strong> La integración con Mercado Pago permite registrar pagos digitales en pedidos. El access token se almacena de forma segura en tu base de datos.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MercadoPagoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Cargando...</div>}>
      <MercadoPagoContent />
    </Suspense>
  )
}
