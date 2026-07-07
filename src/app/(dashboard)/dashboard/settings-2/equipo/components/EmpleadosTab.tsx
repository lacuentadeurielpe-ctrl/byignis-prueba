'use client'

import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2 } from 'lucide-react'

interface Empleado {
  id: string
  nombre: string
  email: string
  rol: string
  estado: string
  local_id?: string | null
}

interface LocalOption {
  id: string
  nombre: string
}

export default function EmpleadosTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [locales, setLocales] = useState<LocalOption[]>([])
  const [multiSucursal, setMultiSucursal] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('vendedor')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchEmpleados()
    // Sucursales del tenant (para asignar empleados) — solo si multi_sucursal
    fetch('/api/sucursales')
      .then(r => r.ok ? r.json() : null)
      .then(ctx => {
        if (ctx?.multiSucursal) {
          setMultiSucursal(true)
          setLocales(ctx.localesVisibles ?? [])
        }
      })
      .catch(() => {})
  }, [])

  const handleAsignarSucursal = async (empleadoId: string, localId: string) => {
    try {
      const res = await fetch('/api/settings-2/equipo/empleados', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empleadoId, local_id: localId || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEmpleados(prev => prev.map(e => (e.id === empleadoId ? { ...e, local_id: updated.local_id } : e)))
      } else {
        const err = await res.json()
        setError(err.error || 'Error al asignar sucursal')
      }
    } catch {
      setError('Error en la conexión')
    }
  }

  const fetchEmpleados = async () => {
    try {
      const res = await fetch('/api/settings-2/equipo/empleados')
      if (res.ok) {
        const data = await res.json()
        setEmpleados(data)
      }
    } catch (err) {
      setError('Error al cargar empleados')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!nombre || !email) {
      setError('Nombre y email son requeridos')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/equipo/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, rol }),
      })

      if (res.ok) {
        const newEmpleado = await res.json()
        setEmpleados([newEmpleado, ...empleados])
        setNombre('')
        setEmail('')
        setRol('vendedor')
        setShowForm(false)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al agregar')
      }
    } catch (err) {
      setError('Error en la conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar empleado?')) return

    try {
      const res = await fetch(`/api/settings-2/equipo/empleados?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setEmpleados(empleados.filter(e => e.id !== id))
      } else {
        setError('Error al eliminar')
      }
    } catch (err) {
      setError('Error en la conexión')
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-start gap-3">
          <span className="flex-shrink-0 font-bold">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-zinc-900">Empleados</h3>
          <p className="text-xs text-zinc-500 mt-1">{empleados.length} empleado{empleados.length !== 1 ? 's' : ''} en el equipo</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl space-y-4">
          <input
            type="text"
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="vendedor">Vendedor</option>
            <option value="gerente">Gerente</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-lg transition"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-lg transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {empleados.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <Mail className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay empleados aún</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega tu primer empleado para comenzar</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Nombre</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Email</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Rol</th>
                {multiSucursal && (
                  <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Sucursal</th>
                )}
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {empleados.map(emp => (
                <tr key={emp.id} className="hover:bg-zinc-50 transition">
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{emp.nombre}</td>
                  <td className="px-5 py-3.5 text-zinc-600 font-mono text-xs">{emp.email}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg capitalize">{emp.rol}</span>
                  </td>
                  {multiSucursal && (
                    <td className="px-5 py-3.5">
                      <select
                        value={emp.local_id ?? ''}
                        onChange={e => handleAsignarSucursal(emp.id, e.target.value)}
                        className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        title="Sucursal asignada — el empleado solo verá y operará esta sucursal"
                      >
                        <option value="">Todas</option>
                        {locales.map(l => (
                          <option key={l.id} value={l.id}>{l.nombre}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar empleado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
