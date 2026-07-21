'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Store,
  Database,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Save,
  CheckCircle2,
  Gift,
  RefreshCw,
  XCircle,
  Loader2
} from 'lucide-react'
import dayjs from 'dayjs'

interface ClientDetailProps {
  data: {
    id: string
    nombre: string
    email: string
    telefono: string
    fecha_registro: string
    kpis: {
      ventasTotales: number
      profitTotal: number
      totalPedidosCompletados: number
      espacioKb: number
    }
    suscripcion: {
      id?: string
      estado: string
      creadoEn?: string
      cicloFin?: string | null
      trialOtorgadoPor?: string | null
      trialOtorgadoAt?: string | null
      trialRenovaciones?: number
    }
  }
}

/** Días que faltan para una fecha YYYY-MM-DD (0 o negativo = vencida). */
function diasRestantes(cicloFin?: string | null): number | null {
  if (!cicloFin) return null
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  return Math.ceil(
    (new Date(cicloFin).getTime() - new Date(hoy).getTime()) / 86_400_000
  )
}

export default function ClientDetail({ data }: ClientDetailProps) {
  const router = useRouter()
  const [estadoSuscripcion, setEstadoSuscripcion] = useState(data.suscripcion.estado)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [trialCargando, setTrialCargando] = useState<null | 'activar' | 'renovar' | 'desactivar'>(null)

  const enTrial   = data.suscripcion.estado === 'trial'
  const diasTrial = enTrial ? diasRestantes(data.suscripcion.cicloFin) : null

  const accionTrial = async (accion: 'activar' | 'renovar' | 'desactivar') => {
    setTrialCargando(accion)
    try {
      const res = await fetch(`/api/superadmin/tenants/${data.id}/trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Error')
      }
      setToast(true)
      setTimeout(() => setToast(false), 3000)
      router.refresh()
    } catch {
      alert('No se pudo actualizar la prueba gratuita')
    } finally {
      setTrialCargando(null)
    }
  }

  useEffect(() => {
    setEstadoSuscripcion(data.suscripcion.estado)
  }, [data.suscripcion.estado])

  const formatearSoles = (valor: number) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(valor)
  }

  const formatStorage = (kb: number) => {
    if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`
    return `${kb.toFixed(2)} KB`
  }

  const handleSaveSuscripcion = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/superadmin/tenants/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoSuscripcion })
      })
      if (!res.ok) throw new Error('Error al guardar')
      
      setToast(true)
      setTimeout(() => setToast(false), 3000)
      router.refresh()
    } catch (err) {
      alert('Error guardando la suscripción')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/superadmin/clientes" className="p-2 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              {data.nombre}
              <span className={`px-2 py-0.5 text-xs rounded-md font-medium border ${
                estadoSuscripcion === 'activo' 
                  ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {estadoSuscripcion === 'activo' ? 'Pro' : 'Inactivo'}
              </span>
            </h1>
            <p className="text-gray-400 text-sm">{data.email} • {data.telefono}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: KPIS */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Rendimiento del Negocio
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <DollarSign className="w-4 h-4" /> Ventas Históricas
              </div>
              <div className="text-3xl font-bold text-white">{formatearSoles(data.kpis.ventasTotales)}</div>
            </div>
            
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <TrendingUp className="w-4 h-4" /> Profit Histórico
              </div>
              <div className="text-3xl font-bold text-green-400">{formatearSoles(data.kpis.profitTotal)}</div>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <ShoppingCart className="w-4 h-4" /> Pedidos Completados
              </div>
              <div className="text-3xl font-bold text-white">{data.kpis.totalPedidosCompletados}</div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-blue-300 text-sm">
                <Database className="w-4 h-4" /> Espacio Ocupado (Supabase)
              </div>
              <div className="text-3xl font-bold text-blue-100">{formatStorage(data.kpis.espacioKb)}</div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: ADMINISTRACIÓN */}
        <div className="space-y-6">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-400" />
            Administración
          </h2>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Estado de Suscripción</label>
              <select 
                value={estadoSuscripcion}
                onChange={(e) => setEstadoSuscripcion(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                <option value="activo">Activo (Pro / Vitalicio)</option>
                <option value="suspendido">Suspendido (Bloqueado)</option>
                <option value="trial">Trial (Prueba temporal)</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Si pones el estado en Activo, el cliente tendrá acceso libre al panel. Si lo suspendes, chocará con el Paywall.
              </p>
            </div>

            <button
              onClick={handleSaveSuscripcion}
              disabled={isSaving || estadoSuscripcion === data.suscripcion.estado}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white px-4 py-3 rounded-xl font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>

            {toast && (
              <div className="flex items-center justify-center gap-2 text-green-400 text-sm mt-4 bg-green-500/10 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4" /> Guardado correctamente
              </div>
            )}

            {/* ── Prueba gratuita (cortesía otorgada por el superadmin) ── */}
            <div className="border-t border-gray-800 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-medium text-white">Prueba gratuita</h3>
              </div>

              {enTrial ? (
                <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-sm font-semibold text-amber-300">
                    {diasTrial !== null && diasTrial > 0
                      ? `Activa — ${diasTrial} ${diasTrial === 1 ? 'día restante' : 'días restantes'}`
                      : 'Vencida'}
                  </p>
                  {data.suscripcion.cicloFin && (
                    <p className="text-xs text-amber-400/70 mt-0.5">
                      Vence el {dayjs(data.suscripcion.cicloFin).format('DD/MM/YYYY')}
                    </p>
                  )}
                  {(data.suscripcion.trialRenovaciones ?? 0) > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Renovada {data.suscripcion.trialRenovaciones} {data.suscripcion.trialRenovaciones === 1 ? 'vez' : 'veces'}
                    </p>
                  )}
                  {data.suscripcion.trialOtorgadoPor && (
                    <p className="text-xs text-gray-500 mt-1">
                      Otorgada por {data.suscripcion.trialOtorgadoPor}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mb-4">
                  Este cliente no tiene prueba activa. Al activarla tendrá 3 días de
                  acceso completo sin pagar.
                </p>
              )}

              <div className="space-y-2">
                {!enTrial && (
                  <button
                    onClick={() => accionTrial('activar')}
                    disabled={trialCargando !== null}
                    className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    {trialCargando === 'activar'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Gift className="w-4 h-4" />}
                    Activar prueba de 3 días
                  </button>
                )}

                {enTrial && (
                  <>
                    <button
                      onClick={() => accionTrial('renovar')}
                      disabled={trialCargando !== null}
                      className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {trialCargando === 'renovar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <RefreshCw className="w-4 h-4" />}
                      Renovar 3 días más
                    </button>
                    <button
                      onClick={() => accionTrial('desactivar')}
                      disabled={trialCargando !== null}
                      className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-gray-700"
                    >
                      {trialCargando === 'desactivar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />}
                      Desactivar prueba
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-2">
            <div className="text-sm flex justify-between">
              <span className="text-gray-400">ID Tenant:</span>
              <span className="text-gray-500 truncate w-32" title={data.id}>{data.id}</span>
            </div>
            <div className="text-sm flex justify-between">
              <span className="text-gray-400">Fecha Registro:</span>
              <span className="text-white">{dayjs(data.fecha_registro).format('DD MMM YYYY')}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
