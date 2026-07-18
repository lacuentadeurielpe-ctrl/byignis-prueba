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
  CheckCircle2
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
    }
  }
}

export default function ClientDetail({ data }: ClientDetailProps) {
  const router = useRouter()
  const [estadoSuscripcion, setEstadoSuscripcion] = useState(data.suscripcion.estado)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState(false)

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
