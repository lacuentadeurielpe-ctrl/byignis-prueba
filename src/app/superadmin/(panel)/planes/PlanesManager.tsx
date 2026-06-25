'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Plan {
  id:                  string
  nombre:              string
  creditos_mes:        number
  precio_mensual:      number
  precio_exceso:       number
  activo:              boolean
  es_publico:          boolean
  creditos_ilimitados: boolean
}

interface Props {
  planes:   Plan[]
  conteo?:  Record<string, number>
}

type FormState = {
  nombre:              string
  creditos_mes:        number
  precio_mensual:      number
  precio_exceso:       number
  es_publico:          boolean
  creditos_ilimitados: boolean
}

const FORM_DEFAULT: FormState = {
  nombre:              '',
  creditos_mes:        500,
  precio_mensual:      99,
  precio_exceso:       0.10,
  es_publico:          true,
  creditos_ilimitados: false,
}

export default function PlanesManager({ planes, conteo = {} }: Props) {
  const router = useRouter()
  const [editando, setEditando] = useState<string | null>(null)
  const [creando,  setCreando]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [form,     setForm]     = useState<FormState>(FORM_DEFAULT)

  function abrirEditar(plan: Plan) {
    setEditando(plan.id)
    setCreando(false)
    setForm({
      nombre:              plan.nombre,
      creditos_mes:        plan.creditos_mes,
      precio_mensual:      Number(plan.precio_mensual),
      precio_exceso:       Number(plan.precio_exceso),
      es_publico:          plan.es_publico,
      creditos_ilimitados: plan.creditos_ilimitados,
    })
    setError(null); setSuccess(null)
  }

  function abrirCrear() {
    setCreando(true); setEditando(null)
    setForm(FORM_DEFAULT)
    setError(null); setSuccess(null)
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true); setError(null)

    const url    = editando ? `/api/superadmin/planes/${editando}` : '/api/superadmin/planes'
    const method = editando ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })

    if (res.ok) {
      setSuccess(editando ? 'Plan actualizado' : 'Plan creado')
      setEditando(null); setCreando(false)
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error guardando plan')
    }
    setLoading(false)
  }

  async function desactivar(id: string, nombre: string) {
    if (!confirm(`¿Desactivar el plan "${nombre}"?`)) return
    setLoading(true); setError(null)
    const res = await fetch(`/api/superadmin/planes/${id}`, { method: 'DELETE' })
    if (res.ok) { setSuccess('Plan desactivado'); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? 'Error') }
    setLoading(false)
  }

  const formatPEN = (n: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)

  return (
    <div>
      {(error || success) && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${error ? 'bg-red-950/30 border border-red-800 text-red-300' : 'bg-green-950/30 border border-green-800 text-green-300'}`}>
          {error || success}
        </div>
      )}

      <div className="space-y-3">
        {planes.map(plan => (
          <div key={plan.id}
            className={`bg-gray-900 border rounded-xl p-5 ${!plan.activo ? 'opacity-40 border-gray-800' : plan.creditos_ilimitados ? 'border-yellow-700/60' : 'border-gray-700'}`}>

            {editando === plan.id ? (
              <FormPlan form={form} setForm={setForm} onGuardar={guardar} onCancelar={() => setEditando(null)} loading={loading} />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white">{plan.nombre}</h3>
                    {plan.creditos_ilimitados && (
                      <span className="text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-700 px-2 py-0.5 rounded-full">
                        Vitalicio ∞
                      </span>
                    )}
                    {!plan.es_publico && (
                      <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
                        Oculto
                      </span>
                    )}
                    {!plan.activo && (
                      <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">
                        Inactivo
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-400">
                    {plan.creditos_ilimitados ? (
                      <span className="text-yellow-400 font-medium">∞ créditos</span>
                    ) : (
                      <span>{plan.creditos_mes.toLocaleString()} cr/mes</span>
                    )}
                    <span>{plan.precio_mensual > 0 ? formatPEN(Number(plan.precio_mensual)) + '/mes' : <span className="text-green-400">Gratis</span>}</span>
                    {Number(plan.precio_exceso) > 0 && (
                      <span>{formatPEN(Number(plan.precio_exceso))}/cr exceso</span>
                    )}
                  </div>

                  {conteo[plan.id] !== undefined && (
                    <p className="text-xs text-gray-600 mt-1.5">{conteo[plan.id]} suscripción(es) activa(s)</p>
                  )}
                </div>

                {plan.activo && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => abrirEditar(plan)}
                      className="px-3 py-1.5 text-xs border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
                      Editar
                    </button>
                    <button onClick={() => desactivar(plan.id, plan.nombre)}
                      className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors">
                      Desactivar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {creando ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <p className="text-sm font-medium text-white mb-4">Nuevo plan</p>
            <FormPlan form={form} setForm={setForm} onGuardar={guardar} onCancelar={() => setCreando(false)} loading={loading} />
          </div>
        ) : (
          <button onClick={abrirCrear}
            className="w-full py-3 border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 rounded-xl text-sm transition-colors">
            + Nuevo plan
          </button>
        )}
      </div>
    </div>
  )
}

function FormPlan({ form, setForm, onGuardar, onCancelar, loading }: {
  form:      FormState
  setForm:   (f: FormState) => void
  onGuardar: () => void
  onCancelar:() => void
  loading:   boolean
}) {
  const set = (key: keyof FormState, val: unknown) => setForm({ ...form, [key]: val })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400">Nombre del plan</label>
          <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Básico, Estándar, Pro, Vitalicio..."
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Créditos por mes</label>
          <input type="number" value={form.creditos_mes} onChange={e => set('creditos_mes', Number(e.target.value))}
            min={0} disabled={form.creditos_ilimitados}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-40" />
          {form.creditos_ilimitados && (
            <p className="text-xs text-yellow-500 mt-0.5">∞ ilimitado — valor ignorado</p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-400">Precio mensual (S/)</label>
          <input type="number" value={form.precio_mensual} onChange={e => set('precio_mensual', Number(e.target.value))}
            min={0} step={0.01}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Precio por crédito en exceso (S/)</label>
          <input type="number" value={form.precio_exceso} onChange={e => set('precio_exceso', Number(e.target.value))}
            min={0} step={0.001}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.es_publico} onChange={e => set('es_publico', e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-indigo-500" />
          <span className="text-sm text-gray-300">Visible en el registro público</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.creditos_ilimitados} onChange={e => set('creditos_ilimitados', e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-yellow-500" />
          <span className="text-sm text-yellow-400">Créditos ilimitados (Vitalicio)</span>
        </label>
      </div>

      {form.creditos_ilimitados && (
        <p className="text-xs text-yellow-700 bg-yellow-950/30 border border-yellow-800/40 rounded-lg px-3 py-2">
          Activar solo para planes Vitalicio. El bot no cobra créditos a estos tenants.
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={onGuardar} disabled={loading}
          className="flex-1 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 font-medium text-sm rounded-lg py-1.5 transition-colors">
          {loading ? 'Guardando...' : 'Guardar plan'}
        </button>
        <button onClick={onCancelar} className="px-3 text-gray-400 hover:text-white text-sm">Cancelar</button>
      </div>
    </div>
  )
}
