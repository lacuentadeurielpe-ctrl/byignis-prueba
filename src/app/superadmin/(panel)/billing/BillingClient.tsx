'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Pago {
  id:            string
  ferreteria_id: string
  creditos:      number
  motivo:        string
  monto_cobrado: number
  created_at:    string
  ferreterias?:  { nombre: string }[] | { nombre: string } | null
}

interface Ferreteria {
  id:           string
  nombre:       string
  estado_tenant: string
}

interface Plan {
  id:             string
  nombre:         string
  precio_mensual: number
}

interface Props {
  pagos:       Pago[]
  ferreterias: Ferreteria[]
  planes:      Plan[]
}

const MOTIVOS: Record<string, string> = {
  plan_mensual:  'Plan mensual',
  recarga_manual:'Recarga manual',
  compensacion:  'Compensación',
  trial:         'Trial',
}

export default function BillingClient({ pagos, ferreterias, planes }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  const [form, setForm] = useState({
    ferreteria_id: '',
    creditos:      500,
    motivo:        'plan_mensual',
    monto_cobrado: 0,
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function preseleccionarPlan(planId: string) {
    const p = planes.find(pl => pl.id === planId)
    if (p) set('monto_cobrado', Number(p.precio_mensual))
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ferreteria_id) { setError('Selecciona una ferretería'); return }
    if (form.creditos <= 0)  { setError('Créditos deben ser > 0'); return }
    setLoading(true); setError(null)
    const res = await fetch(`/api/superadmin/tenants/${form.ferreteria_id}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creditos:     form.creditos,
        motivo:       form.motivo,
        monto_cobrado:form.monto_cobrado,
      }),
    })
    if (res.ok) {
      setSuccess(`Pago registrado: +${form.creditos.toLocaleString()} cr — S/ ${form.monto_cobrado.toFixed(2)}`)
      setShowForm(false)
      setForm({ ferreteria_id: '', creditos: 500, motivo: 'plan_mensual', monto_cobrado: 0 })
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error registrando pago')
    }
    setLoading(false)
  }

  return (
    <div>
      {/* Feedback */}
      {(error || success) && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${error ? 'bg-red-950/30 border border-red-800 text-red-300' : 'bg-green-950/30 border border-green-800 text-green-300'}`}>
          {error || success}
        </div>
      )}

      {/* Botón Registrar Pago */}
      <div className="flex justify-end mb-4">
        <button onClick={() => { setShowForm(v => !v); setError(null); setSuccess(null) }}
          className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm hover:bg-gray-100 font-medium transition-colors">
          {showForm ? 'Cancelar' : '+ Registrar pago'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={registrarPago} className="mb-6 bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Registrar pago recibido</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Ferretería</label>
              <select value={form.ferreteria_id} onChange={e => set('ferreteria_id', e.target.value)} required
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">— Seleccionar —</option>
                {ferreterias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Motivo</label>
              <select value={form.motivo} onChange={e => set('motivo', e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                {Object.entries(MOTIVOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Créditos a agregar</label>
              <input type="number" value={form.creditos} onChange={e => set('creditos', Number(e.target.value))}
                min={1} max={100000}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Monto cobrado (S/)</label>
              <input type="number" value={form.monto_cobrado} onChange={e => set('monto_cobrado', Number(e.target.value))}
                min={0} step={0.01}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          {/* Atajos por plan */}
          {planes.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Prellenar por plan:</p>
              <div className="flex flex-wrap gap-1">
                {planes.filter(p => Number(p.precio_mensual) > 0).map(p => (
                  <button key={p.id} type="button" onClick={() => preseleccionarPlan(p.id)}
                    className="px-2 py-0.5 text-xs border border-gray-600 text-gray-400 hover:border-indigo-500 hover:text-indigo-300 rounded transition-colors">
                    {p.nombre} (S/ {Number(p.precio_mensual).toFixed(0)})
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 font-medium text-sm rounded-lg py-2 transition-colors">
            {loading ? 'Registrando...' : `Registrar — S/ ${form.monto_cobrado.toFixed(2)} + ${form.creditos.toLocaleString()} cr`}
          </button>
        </form>
      )}

      {/* Tabla de pagos */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Ferretería</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Motivo</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Créditos</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Monto</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {pagos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500">Sin pagos registrados</td>
              </tr>
            )}
            {pagos.map((p, i) => (
              <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-2.5 text-white text-sm">
                  {(p.ferreterias as any)?.nombre ?? p.ferreteria_id.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400">{MOTIVOS[p.motivo] ?? p.motivo}</td>
                <td className="px-4 py-2.5 text-right text-indigo-300 font-mono text-xs">+{p.creditos.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-green-400 font-semibold text-sm">
                  S/ {Number(p.monto_cobrado).toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                  {new Date(p.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
