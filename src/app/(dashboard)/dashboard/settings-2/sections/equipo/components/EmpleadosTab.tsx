'use client'

import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2 } from 'lucide-react'

interface Empleado {
  id: string
  nombre: string
  email: string
  rol: string
  estado: string
}

export default function EmpleadosTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('vendedor')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchEmpleados()
  }, [])

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

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="flex justify-between items-center">
        <h3 className="font-medium text-zinc-900">Empleados ({empleados.length})</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          >
            <option value="vendedor">Vendedor</option>
            <option value="gerente">Gerente</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {empleados.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay empleados aún</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Rol</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map(emp => (
                <tr key={emp.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{emp.nombre}</td>
                  <td className="px-4 py-3 text-zinc-600">{emp.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">{emp.rol}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded"
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
