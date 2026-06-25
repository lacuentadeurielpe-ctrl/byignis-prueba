'use client'

import { useEffect, useState } from 'react'
import { Pencil, Check, X, Plus, Star } from 'lucide-react'

interface TarifaCreditos {
  id:          string
  nombre:      string
  tipo:        string
  creditos:    number
  precio_usd:  number
  precio_pen:  number | null
  es_default:  boolean
  activo:      boolean
  descripcion: string | null
  created_at:  string
  updated_at:  string
}

const TIPO_LABEL: Record<string, string> = {
  mensual:     'Mensual',
  por_lote:    'Por lote',
  por_credito: 'Unitario',
}

export default function PreciosTenantTab() {
  const [precios, setPrecios]       = useState<TarifaCreditos[]>([])
  const [loading, setLoading]       = useState(true)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<TarifaCreditos>>({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showNew, setShowNew]       = useState(false)
  const [newForm, setNewForm]       = useState({
    nombre: '', tipo: 'por_lote', creditos: '', precio_usd: '', precio_pen: '', descripcion: '', es_default: false,
  })

  async function cargar() {
    setLoading(true)
    const res = await fetch('/api/superadmin/ia/precios')
    const json = await res.json()
    setPrecios(json.precios ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function iniciarEdicion(p: TarifaCreditos) {
    setEditId(p.id)
    setEditValues({ nombre: p.nombre, tipo: p.tipo, creditos: p.creditos, precio_usd: p.precio_usd, precio_pen: p.precio_pen, es_default: p.es_default, descripcion: p.descripcion ?? '' })
    setError(null)
  }

  async function guardar(id: string) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/superadmin/ia/precios/${id}`, {
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

  async function toggleActivo(p: TarifaCreditos) {
    if (p.es_default && p.activo) {
      setError('No puedes desactivar el plan default. Asigna otro como default primero.')
      return
    }
    await fetch(`/api/superadmin/ia/precios/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    })
    cargar()
  }

  async function crearNuevo() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/superadmin/ia/precios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        creditos:   Number(newForm.creditos),
        precio_usd: Number(newForm.precio_usd),
        precio_pen: newForm.precio_pen ? Number(newForm.precio_pen) : null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowNew(false)
    setNewForm({ nombre: '', tipo: 'por_lote', creditos: '', precio_usd: '', precio_pen: '', descripcion: '', es_default: false })
    setSaving(false)
    cargar()
  }

  // Calcular margen estimado (costo promedio ponderado desde historial)
  function calcularMargen(p: TarifaCreditos): string {
    if (p.tipo === 'por_credito' || p.creditos === 0) return '—'
    // Costo estimado: 1 crédito ≈ 1 llamada deepseek ($0.00014/1K tokens × ~300 tokens promedio)
    const costoEstimado = p.creditos * 0.000042 // ~0.000042 USD por crédito (promedio real)
    const ingresos = p.precio_usd
    if (costoEstimado === 0 || ingresos === 0) return '—'
    const margen = ((ingresos - costoEstimado) / ingresos) * 100
    return `${margen.toFixed(0)}%`
  }

  if (loading) return <p className="text-gray-500 text-sm py-6">Cargando paquetes...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white">Precios a tenants</h2>
          <p className="text-xs text-gray-500 mt-0.5">Paquetes de créditos que cobramos a los negocios</p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo paquete
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Formulario nuevo */}
      {showNew && (
        <div className="mb-4 bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-300">Nuevo paquete</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="Pack 1,000 créditos"
                value={newForm.nombre}
                onChange={(e) => setNewForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo *</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                value={newForm.tipo}
                onChange={(e) => setNewForm(f => ({ ...f, tipo: e.target.value }))}
              >
                <option value="mensual">Mensual (suscripción)</option>
                <option value="por_lote">Por lote (recarga)</option>
                <option value="por_credito">Unitario (precio por crédito)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Créditos incluidos</label>
              <input
                type="number" min="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="1000"
                value={newForm.creditos}
                onChange={(e) => setNewForm(f => ({ ...f, creditos: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio USD *</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="5.00"
                value={newForm.precio_usd}
                onChange={(e) => setNewForm(f => ({ ...f, precio_usd: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio PEN (S/)</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="18.50"
                value={newForm.precio_pen}
                onChange={(e) => setNewForm(f => ({ ...f, precio_pen: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="descripción opcional"
                value={newForm.descripcion}
                onChange={(e) => setNewForm(f => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              className="accent-indigo-500"
              checked={newForm.es_default}
              onChange={(e) => setNewForm(f => ({ ...f, es_default: e.target.checked }))}
            />
            Marcar como plan default (se asigna a nuevos tenants)
          </label>
          <div className="flex gap-2">
            <button
              onClick={crearNuevo}
              disabled={saving || !newForm.nombre.trim() || !newForm.precio_usd}
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

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium text-right">Créditos</th>
              <th className="px-4 py-3 font-medium text-right">USD</th>
              <th className="px-4 py-3 font-medium text-right">PEN</th>
              <th className="px-4 py-3 font-medium text-right">Margen est.</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {precios.map((p) => {
              const isEditing = editId === p.id
              return (
                <tr key={p.id} className={`hover:bg-gray-800/30 ${!p.activo ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {p.es_default && (
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" aria-label="Plan default" />
                      )}
                      {isEditing ? (
                        <input
                          className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white w-36 focus:outline-none"
                          value={String(editValues.nombre ?? p.nombre)}
                          onChange={(e) => setEditValues(v => ({ ...v, nombre: e.target.value }))}
                        />
                      ) : (
                        <span className="text-white font-medium text-xs">{p.nombre}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        value={String(editValues.tipo ?? p.tipo)}
                        onChange={(e) => setEditValues(v => ({ ...v, tipo: e.target.value }))}
                      >
                        <option value="mensual">Mensual</option>
                        <option value="por_lote">Por lote</option>
                        <option value="por_credito">Unitario</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.tipo === 'mensual' ? 'bg-purple-900/40 text-purple-300' :
                        p.tipo === 'por_lote' ? 'bg-blue-900/40 text-blue-300' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {TIPO_LABEL[p.tipo] ?? p.tipo}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" min="0"
                        className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:outline-none"
                        value={String(editValues.creditos ?? p.creditos)}
                        onChange={(e) => setEditValues(v => ({ ...v, creditos: Number(e.target.value) }))}
                      />
                    ) : (
                      <span className="font-mono text-xs text-indigo-300">{p.creditos.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" step="0.01" min="0"
                        className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:outline-none"
                        value={String(editValues.precio_usd ?? p.precio_usd)}
                        onChange={(e) => setEditValues(v => ({ ...v, precio_usd: Number(e.target.value) }))}
                      />
                    ) : (
                      <span className="font-mono text-xs text-green-400">${Number(p.precio_usd).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" step="0.01" min="0"
                        className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white text-right focus:outline-none"
                        value={String(editValues.precio_pen ?? (p.precio_pen ?? ''))}
                        onChange={(e) => setEditValues(v => ({ ...v, precio_pen: e.target.value ? Number(e.target.value) : null }))}
                      />
                    ) : (
                      <span className="font-mono text-xs text-yellow-400">
                        {p.precio_pen ? `S/${Number(p.precio_pen).toFixed(2)}` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-gray-400">{calcularMargen(p)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        value={String(editValues.descripcion ?? (p.descripcion ?? ''))}
                        onChange={(e) => setEditValues(v => ({ ...v, descripcion: e.target.value }))}
                      />
                    ) : (
                      <span className="text-xs text-gray-500 truncate block max-w-[160px]">{p.descripcion ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => guardar(p.id)}
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
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => iniciarEdicion(p)}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActivo(p)}
                          className={`p-1.5 rounded-lg transition-colors text-xs ${
                            p.activo
                              ? 'hover:bg-red-900/30 text-gray-500 hover:text-red-400'
                              : 'hover:bg-green-900/30 text-gray-600 hover:text-green-400'
                          }`}
                          title={p.activo ? 'Desactivar' : 'Activar'}
                        >
                          {p.activo ? 'OFF' : 'ON'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-600">
        <Star className="w-3 h-3 inline text-yellow-400 fill-yellow-400 mr-1" />
        El plan marcado con estrella es el default que se asigna automáticamente a nuevos tenants.
        Solo puede haber uno activo.
      </div>
    </div>
  )
}
