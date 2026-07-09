'use client'

import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2, MapPin, Shield, Building2, ExternalLink } from 'lucide-react'
import { useEmpleados } from '@/hooks/rrhh/useEmpleados'
import Link from 'next/link'

interface LocalOption {
  id: string
  nombre: string
}

export default function EmpleadosTab({ filterRole }: { filterRole?: string } = {}) {
  const { empleados: todosLosEmpleados, loading, error, fetchEmpleados, addEmpleado, deleteEmpleado, updateEmpleado } = useEmpleados()
  const empleados = filterRole ? todosLosEmpleados.filter(e => e.rol === filterRole) : todosLosEmpleados

  const [locales, setLocales] = useState<LocalOption[]>([])
  const [multiSucursal, setMultiSucursal] = useState(false)
  
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState(filterRole || 'vendedor')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchEmpleados()
    // Sucursales del tenant (para asignar empleados)
    fetch('/api/sucursales')
      .then(r => r.ok ? r.json() : null)
      .then(ctx => {
        if (ctx?.multiSucursal) {
          setMultiSucursal(true)
          setLocales(ctx.localesVisibles ?? [])
        }
      })
      .catch(() => {})
  }, [fetchEmpleados])

  const handleAsignarSucursal = async (empleadoId: string, localId: string) => {
    try {
      const res = await fetch('/api/settings-2/equipo/empleados', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empleadoId, local_id: localId || null }),
      })
      if (res.ok) {
        // En un futuro cercano migraremos esto al uso de empleado_sucursal pivot,
        // por ahora mantenemos compatibilidad con local_id
        await updateEmpleado(empleadoId, { local_id: localId || null } as any)
      } else {
        const err = await res.json()
        alert(err.error || 'Error al asignar sucursal')
      }
    } catch {
      alert('Error en la conexión')
    }
  }

  const handleAdd = async () => {
    if (!nombre || !email || !password) {
      setFormError('Nombre, email y contraseña son requeridos')
      return
    }
    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setIsSaving(true)
    setFormError('')

    const res = await addEmpleado({ nombre, email, password, rol })
    if (res.success) {
      setNombre('')
      setEmail('')
      setPassword('')
      setRol('vendedor')
      setShowForm(false)
    } else {
      setFormError(res.error || 'Error al agregar')
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar empleado?')) return
    const res = await deleteEmpleado(id)
    if (!res.success) {
      alert(res.error || 'Error al eliminar')
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  )

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start gap-3">
          <span className="flex-shrink-0 font-bold mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 tracking-tight">Directorio de Empleados</h3>
          <p className="text-sm text-zinc-500 mt-1">{empleados.length} empleado{empleados.length !== 1 ? 's' : ''} en tu organización</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nuevo Empleado
        </button>
      </div>

      {/* Formulario (Desplegable) */}
      {showForm && (
        <div className="p-5 sm:p-6 bg-white border border-zinc-200 shadow-sm rounded-2xl space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <h4 className="font-semibold text-zinc-900">Agregar Empleado</h4>
          {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">{formError}</p>}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nombre completo"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <input
              type="text"
              placeholder="Contraseña temporal"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <select
              value={rol}
              onChange={e => setRol(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            >
              <option value="vendedor">Vendedor (Mostrador)</option>
              <option value="gerente">Gerente de Sucursal</option>
              <option value="admin">Administrador General</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="flex-1 sm:flex-none sm:w-32 px-4 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl transition-all shadow-sm"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 sm:flex-none sm:w-32 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Grid de Tarjetas (Mobile-First) */}
      {empleados.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
          <div className="w-16 h-16 bg-white shadow-sm border border-zinc-100 rounded-2xl flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-zinc-300" />
          </div>
          <p className="text-zinc-900 font-semibold">Tu equipo está vacío</p>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm">Comienza agregando a tu primer empleado para darle acceso al punto de venta y gestionar su nómina.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {empleados.map(emp => (
            <div key={emp.id} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition-shadow group flex flex-col h-full relative overflow-hidden">
              {/* Círculo decorativo fondo */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h4 className="font-bold text-zinc-900 text-lg leading-tight">{emp.nombre}</h4>
                  <p className="text-sm text-zinc-500 font-mono mt-0.5">{emp.email}</p>
                </div>
                <button
                  onClick={() => handleDelete(emp.id)}
                  className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                  title="Eliminar empleado"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 flex-grow relative z-10">
                {/* Rol */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Rol en Sistema</p>
                    <p className="text-sm font-semibold text-zinc-900 capitalize">{emp.rol}</p>
                  </div>
                </div>

                {/* Sucursal (Si es multi) */}
                {multiSucursal && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Sucursal Base</p>
                      <select
                        value={emp.local_id ?? ''}
                        onChange={e => handleAsignarSucursal(emp.id, e.target.value)}
                        className="mt-0.5 block w-full py-1 px-2 -ml-2 text-sm font-medium text-zinc-900 bg-transparent hover:bg-zinc-100 rounded-md border-transparent focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer transition-colors"
                      >
                        <option value="">Todas (Acceso Global)</option>
                        {locales.map(l => (
                          <option key={l.id} value={l.id}>{l.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón ver perfil 360 */}
              <div className="pt-5 mt-auto border-t border-zinc-100 relative z-10">
                <Link 
                  href={`/dashboard/equipo/empleados/${emp.id}`}
                  className="flex items-center justify-center w-full gap-2 py-2.5 px-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-sm font-semibold rounded-xl transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-700"
                >
                  Ver Perfil 360°
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
