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

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="flex justify-between items-center">
        <h3 className="font-medium text-zinc-900">Categorías ({categorias.length})</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Nombre categoría"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="text"
            placeholder="Descripción"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="text"
            placeholder="Icono (emoji)"
            value={icono}
            onChange={e => setIcono(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm text-center text-2xl"
            maxLength={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {categorias.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay categorías</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {categorias.map(cat => (
            <div key={cat.id} className="p-4 border border-zinc-200 rounded-lg flex justify-between items-start">
              <div>
                <p className="text-2xl">{cat.icono}</p>
                <p className="font-medium text-zinc-900">{cat.nombre}</p>
                {cat.descripcion && <p className="text-sm text-zinc-600 mt-1">{cat.descripcion}</p>}
              </div>
              <button onClick={() => handleDelete(cat.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
