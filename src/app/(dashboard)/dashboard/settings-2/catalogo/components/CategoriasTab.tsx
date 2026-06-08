'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'

interface Categoria {
  id: string
  nombre: string
  descripcion: string
  icono: string
  orden: number
}

export default function CategoriasTab() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [icono, setIcono] = useState('📦')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCategorias()
  }, [])

  const fetchCategorias = async () => {
    try {
      const res = await fetch('/api/settings-2/catalogo/categorias')
      if (res.ok) {
        setCategorias(await res.json())
      }
    } catch (err) {
      setError('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!nombre) {
      setError('Nombre es requerido')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/catalogo/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion, icono }),
      })

      if (res.ok) {
        const newCat = await res.json()
        setCategorias([...categorias, newCat])
        setNombre('')
        setDescripcion('')
        setIcono('📦')
        setShowForm(false)
      } else {
        const err = await res.json()
        setError(err.error)
      }
    } catch (err) {
      setError('Error en la conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar categoría?')) return

    try {
      const res = await fetch(`/api/settings-2/catalogo/categorias?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCategorias(categorias.filter(c => c.id !== id))
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
          <h3 className="font-semibold text-zinc-900">Categorías</h3>
          <p className="text-xs text-zinc-500 mt-1">{categorias.length} categoría{categorias.length !== 1 ? 's' : ''} configurada{categorias.length !== 1 ? 's' : ''}</p>
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
            placeholder="Nombre categoría"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Descripción"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Icono (emoji)"
            value={icono}
            onChange={e => setIcono(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm text-center text-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            maxLength={2}
          />
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

      {categorias.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <Package className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay categorías</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega una nueva categoría para comenzar</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map(cat => (
            <div
              key={cat.id}
              className="p-5 border border-zinc-200 rounded-xl bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/40 transition-all group"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <p className="text-3xl mb-2 group-hover:scale-110 transition duration-200">{cat.icono}</p>
                  <p className="font-semibold text-zinc-900 group-hover:text-indigo-700 transition">{cat.nombre}</p>
                  {cat.descripcion && <p className="text-xs text-zinc-600 mt-2 line-clamp-2">{cat.descripcion}</p>}
                </div>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition flex-shrink-0"
                  title="Eliminar categoría"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
