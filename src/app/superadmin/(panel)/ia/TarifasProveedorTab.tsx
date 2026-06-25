'use client'

import { useEffect, useState } from 'react'
import { Pencil, Check, X, Plus, Power } from 'lucide-react'

interface TarifaIA {
  id:                    string
  modelo:                string
  proveedor:             string
  unidad:                string
  precio_entrada_por_1k: number
  precio_salida_por_1k:  number
  activo:                boolean
  notas:                 string | null
  actualizado_at:        string
}

export default function TarifasProveedorTab() {
  const [tarifas, setTarifas]         = useState<TarifaIA[]>([])
  const [loading, setLoading]         = useState(true)
  const [editId, setEditId]           = useState<string | null>(null)
  const [editValues, setEditValues]   = useState<Partial<TarifaIA>>({})
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showNew, setShowNew]         = useState(false)
  const [newForm, setNewForm]         = useState({
    modelo: '', proveedor: '', unidad: 'tokens',
    precio_entrada_por_1k: '', precio_salida_por_1k: '', notas: '',
  })

  async function cargar() {
    setLoading(true)
    const res = await fetch('/api/superadmin/ia/tarifas')
    const json = await res.json()
    setTarifas(json.tarifas ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function iniciarEdicion(t: TarifaIA) {
    setEditId(t.id)
    setEditValues({
      proveedor:             t.proveedor,
      unidad:                t.unidad,
      precio_entrada_por_1k: t.precio_entrada_por_1k,
      precio_salida_por_1k:  t.precio_salida_por_1k,
      notas:                 t.notas ?? '',
    })
    setError(null)
  }

  async function guardar(id: string) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/superadmin/ia/tarifas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editValues),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setEditId(null)
    setSaving(false)
    cargar()
  }

  async function toggleActivo(t: TarifaIA) {
    await fetch(`/api/superadmin/ia/tarifas/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !t.activo }),
    })
    cargar()
  }

  async function crearNuevo() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/superadmin/ia/tarifas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        precio_entrada_por_1k: Number(newForm.precio_entrada_por_1k),
        precio_salida_por_1k:  Number(newForm.precio_salida_por_1k),
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowNew(false)
    setNewForm({ modelo: '', proveedor: '', unidad: 'tokens', precio_entrada_por_1k: '', precio_salida_por_1k: '', notas: '' })
    setSaving(false)
    cargar()
  }

  const PROVEEDOR_COLOR: Record<string, string> = {
    Anthropic: 'text-orange-400',
    OpenAI:    'text-green-400',
    DeepSeek:  'text-blue-400',
    Google:    'text-yellow-400',
  }

  if (loading) return <p className="text-gray-500 text-sm py-6">Cargando tarifas...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white">Tarifas de proveedores IA</h2>
          <p className="text-xs text-gray-500 mt-0.5">Lo que pagamos a Anthropic, DeepSeek, OpenAI y Google por cada llamada</p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo modelo
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Formulario nuevo */}
      {showNew && (
        <div className="mb-4 bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-300">Agregar modelo</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Modelo *</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="ej. claude-opus-4"
                value={newForm.modelo}
                onChange={(e) => setNewForm(f => ({ ...f, modelo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Proveedor *</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="ej. Anthropic"
                value={newForm.proveedor}
                onChange={(e) => setNewForm(f => ({ ...f, proveedor: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Unidad</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                value={newForm.unidad}
                onChange={(e) => setNewForm(f => ({ ...f, unidad: e.target.value }))}
              >
                <option value="tokens">tokens</option>
                <option value="minutos">minutos</option>
                <option value="imagenes">imágenes</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio entrada /1K unidades (USD)</label>
              <input
                type="number" step="0.000001" min="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="0.003000"
                value={newForm.precio_entrada_por_1k}
                onChange={(e) => setNewForm(f => ({ ...f, precio_entrada_por_1k: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio salida /1K unidades (USD)</label>
              <input
                type="number" step="0.000001" min="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="0.015000"
                value={newForm.precio_salida_por_1k}
                onChange={(e) => setNewForm(f => ({ ...f, precio_salida_por_1k: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notas</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="descripción opcional"
                value={newForm.notas}
                onChange={(e) => setNewForm(f => ({ ...f, notas: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={crearNuevo}
              disabled={saving || !newForm.modelo.trim() || !newForm.proveedor.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
            >
              {saving ? 'Guardando…' : 'Agregar'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla de tarifas */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium text-right">Entrada /1K</th>
              <th className="px-4 py-3 font-medium text-right">Salida /1K</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium">Notas</th>
              <th className="px-4 py-3 font-medium text-center">Estado</th>
              <th className="px-4 py-3 font-medium text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {tarifas.map((t) => {
              const isEditing = editId === t.id
              return (
                <tr key={t.id} className={`hover:bg-gray-800/30 ${!t.activo ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-white">{t.modelo}</span>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        value={String(editValues.proveedor ?? t.proveedor)}
                        onChange={(e) => setEditValues(v => ({ ...v, proveedor: e.target.value }))}
                      />
                    ) : (
                      <span className={`text-xs font-medium ${PROVEEDOR_COLOR[t.proveedor] ?? 'text-gray-300'}`}>
                        {t.proveedor}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" step="0.000001" min="0"
                        className="w-28 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:outline-none"
                        value={String(editValues.precio_entrada_por_1k ?? t.precio_entrada_por_1k)}
                        onChange={(e) => setEditValues(v => ({ ...v, precio_entrada_por_1k: Number(e.target.value) }))}
                      />
                    ) : (
                      <span className="font-mono text-xs text-green-400">
                        ${Number(t.precio_entrada_por_1k).toFixed(6)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" step="0.000001" min="0"
                        className="w-28 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:outline-none"
                        value={String(editValues.precio_salida_por_1k ?? t.precio_salida_por_1k)}
                        onChange={(e) => setEditValues(v => ({ ...v, precio_salida_por_1k: Number(e.target.value) }))}
                      />
                    ) : (
                      <span className="font-mono text-xs text-blue-400">
                        ${Number(t.precio_salida_por_1k).toFixed(6)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        value={String(editValues.unidad ?? t.unidad)}
                        onChange={(e) => setEditValues(v => ({ ...v, unidad: e.target.value }))}
                      >
                        <option value="tokens">tokens</option>
                        <option value="minutos">minutos</option>
                        <option value="imagenes">imágenes</option>
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">{t.unidad}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {isEditing ? (
                      <input
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        value={String(editValues.notas ?? (t.notas ?? ''))}
                        onChange={(e) => setEditValues(v => ({ ...v, notas: e.target.value }))}
                      />
                    ) : (
                      <span className="text-xs text-gray-500 truncate block max-w-[180px]">{t.notas ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(t)}
                      title={t.activo ? 'Desactivar' : 'Activar'}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                        t.activo
                          ? 'bg-green-900/40 text-green-400 hover:bg-red-900/40 hover:text-red-400'
                          : 'bg-gray-800 text-gray-500 hover:bg-green-900/40 hover:text-green-400'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => guardar(t.id)}
                          disabled={saving}
                          className="p-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white disabled:opacity-40"
                          title="Guardar"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => iniciarEdicion(t)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-600">
        * Los cambios se aplican a las siguientes llamadas IA (cache se invalida al guardar).
        El historial de costos ya guardado en movimientos_creditos no se recalcula retroactivamente.
      </p>
    </div>
  )
}
