'use client'

import { useState, useEffect } from 'react'
import { Banknote, AlertCircle, CheckCircle } from 'lucide-react'
import SettingsHeader from '../../../components/SettingsHeader'
import FormSection from '../../../components/FormSection'

interface MPData {
  estado?: 'conectado' | 'desconectado' | 'error'
  metadata?: {
    email?: string
    user_id?: string
  }
}

export default function MercadoPagoPage() {
  const [data, setData] = useState<MPData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/integraciones/mercadopago')
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch (err) {
        setError('Error al cargar configuración')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleConnect = () => {
    const redirectUrl = `/api/auth/mercadopago?redirect_uri=${encodeURIComponent(window.location.href)}`
    window.location.href = redirectUrl
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Mercado Pago?')) return

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/integraciones/mercadopago', {
        method: 'DELETE',
      })

      if (res.ok) {
        setData({ estado: 'desconectado' })
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
                    <p className="text-sm text-emerald-700">Mercado Pago está activo como {data.metadata?.email}</p>
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
          </div>
        </FormSection>

        <FormSection
          title="Configuración"
          description="Administra tu conexión con Mercado Pago"
          icon={<Banknote className="w-5 h-5" />}
          isDirty={true}
        >
          <div className="space-y-4">
            {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

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
                  onClick={handleConnect}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                >
                  Conectar con Mercado Pago
                </button>
              )}
            </div>
          </div>
        </FormSection>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            ℹ️ <strong>Nota:</strong> Se abrirá una ventana de autenticación segura de Mercado Pago.
          </p>
        </div>
      </div>
    </div>
  )
}
