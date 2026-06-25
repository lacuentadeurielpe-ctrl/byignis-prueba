'use client'

import { useEffect, useState } from 'react'
import { Pencil, Check, X, Plus, Users } from 'lucide-react'

interface Plan {
  id:                     string
  nombre:                 string
  creditos_mes:           number
  precio_mensual:         number
  precio_exceso:          number
  activo:                 boolean
  suscripciones_activas:  number
  costo_ia_promedio_usd:  number
}

const TIPO_CAMBIO_REF = 3.75

export default function PreciosTenantTab() {
  const [planes, setPlanes]         = useState<Plan[]>([])
  const [loading, setLoading]       = useState(true)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Plan>>({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showNew, setShowNew]       = useState(false)
  const [newForm, setNewForm]       = useState({ nombre: '', creditos_mes: 500, precio_mensual: 99, precio_exceso: 0.10 })

  async function cargar() {
    setLoading(true)
    const res  = await fetch('/api/superadmin/ia/planes')
    const json = await res.json()
    setPlanes(json.planes ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function iniciarEdicion(p: Plan) {
    setEditId(p.id)
    setEditValues({ nombre: p.nombre, creditos_mes: p.creditos_mes, precio_mensual: Number(p.precio_mensual), precio_exceso: Number(p.precio_exceso) })
    setError(null)
  }

  async function guardar(id: string) {
    setSaving(true); setError(null)
    const res  = await fetch(`/api/superadmin/ia/planes/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(editValues),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setEditId(null); setSaving(false); cargar()
  }

  async function desactivar(id: string) {
    if (!confirm('¿Desactivar este plan?')) return
    setSaving(true); setError(null)
    const res  = await fetch(`/api/superadmin/ia/planes/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false); cargar()
  }

  async function crearNuevo() {
    setSaving(true); setError(null)
    const res  = await fetch('/api/superadmin/ia/planes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(newForm),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowNew(false)
    setNewForm({ nombre: '', creditos_mes: 500, precio_mensual: 99, precio_exceso: 0.10 })
    setSaving(false); cargar()
  }

  function margenMensual(plan: Plan): { margenUsd: number; pct: string } | null {
    const precioUsd = Number(plan.precio_mensual) / TIPO_CAMBIO_REF
    const costoUsd  = plan.costo_ia_promedio_usd
    if (precioUsd <= 0) return null
    return {
      margenUsd: precioUsd - costoUsd,
      pct:       `${Math.round(((precioUsd - costoUsd) / precioUsd) * 100)}%`,
    }
  }

  if (loading) return <p className="text-gray-500 text-sm py-6">Cargando planes...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white">Planes de suscripción</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Precios que pagan los tenants. El margen compara el precio mensual con el costo real de IA del último mes.
          </p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo plan
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Formulario nuevo plan */}
      {showNew && (
        <div className="mb-4 bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-300">Nuevo plan</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="Básico, Pro..."
                value={newForm.nombre}
                onChange={(e) => setNewForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Créditos / mes</label>
              <input type="number" min="1"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={newForm.creditos_mes}
                onChange={(e) => setNewForm(f => ({ ...f, creditos_mes: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio mensual (S/)</label>
              <input type="number" min="0" step="0.01"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={newForm.precio_mensual}
                onChange={(e) => setNewForm(f => ({ ...f, precio_mensual: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio exceso / crédito (S/)</label>
              <input type="number" min="0" step="0.01"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={newForm.precio_exceso}
                onChange={(e) => setNewForm(f => ({ ...f, precio_exceso: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={crearNuevo} disabled={saving || !newForm.nombre.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
              {saving ? 'Guardando…' : 'Crear plan'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Planes */}
      <div className="space-y-3">
        {planes.map((plan) => {
          const isEditing = editId === plan.id
          const margen    = margenMensual(plan)
          const precioUsd = Number(plan.precio_mensual) / TIPO_CAMBIO_REF

          return (
            <div key={plan.id} className={`bg-gray-900 border rounded-2xl overflow-hidden ${!plan.activo ? 'opacity-50 border-gray-800' : 'border-gray-700'}`}>
              <div className="px-5 py-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Nombre',              key: 'nombre',         type: 'text',   step: undefined },
                        { label: 'Créditos / mes',      key: 'creditos_mes',   type: 'number', step: 1 },
                        { label: 'Precio mensual (S/)', key: 'precio_mensual', type: 'number', step: 0.01 },
                        { label: 'Precio exceso (S/)',  key: 'precio_exceso',  type: 'number', step: 0.01 },
                      ].map(({ label, key, type, step }) => (
                        <div key={key}>
                          <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                          <input
                            type={type} step={step} min={type === 'number' ? 0 : undefined}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                            value={String((editValues as any)[key] ?? '')}
                            onChange={(e) => setEditValues(v => ({ ...v, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => guardar(plan.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg disabled:opacity-40 transition-colors">
                        <Check className="w-3.5 h-3.5" /> {saving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditId(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold text-white">{plan.nombre}</h3>
                        {!plan.activo && (
                          <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3 h-3" />
                          {plan.suscripciones_activas} {plan.suscripciones_activas === 1 ? 'suscripción' : 'suscripciones'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gray-800/60 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-500 mb-0.5">Créditos / mes</p>
                          <p className="font-semibold text-indigo-400">{plan.creditos_mes.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-800/60 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-500 mb-0.5">Precio mensual</p>
                          <p className="font-semibold text-white">S/ {Number(plan.precio_mensual).toFixed(2)}</p>
                          <p className="text-xs text-gray-600">${precioUsd.toFixed(2)} USD ref.</p>
                        </div>
                        <div className="bg-gray-800/60 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-500 mb-0.5">Costo IA / mes</p>
                          {plan.costo_ia_promedio_usd > 0 ? (
                            <>
                              <p className="font-semibold text-red-400">${plan.costo_ia_promedio_usd.toFixed(4)}</p>
                              <p className="text-xs text-gray-600">prom. por tenant</p>
                            </>
                          ) : (
                            <p className="font-semibold text-gray-600">Sin datos</p>
                          )}
                        </div>
                        <div className="bg-gray-800/60 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-500 mb-0.5">Margen estimado</p>
                          {margen ? (
                            <>
                              <p className={`font-semibold ${margen.margenUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {margen.pct}
                              </p>
                              <p className="text-xs text-gray-600">${margen.margenUsd.toFixed(4)}/mes</p>
                            </>
                          ) : (
                            <p className="font-semibold text-gray-600">—</p>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        Crédito en exceso: <span className="text-gray-300">S/ {Number(plan.precio_exceso).toFixed(2)}</span> / cr
                      </p>
                    </div>

                    {plan.activo && (
                      <div className="flex gap-2 ml-4 shrink-0">
                        <button onClick={() => iniciarEdicion(plan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                        <button onClick={() => desactivar(plan.id)} disabled={saving}
                          className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-40">
                          Desactivar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {planes.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-10 text-center text-gray-500">
            <p className="text-sm">Sin planes configurados.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-600">
        * Tipo de cambio referencial usado para convertir S/ → USD: {TIPO_CAMBIO_REF}.
        El costo IA se calcula sobre los movimientos reales de los últimos 30 días.
      </p>
    </div>
  )
}
