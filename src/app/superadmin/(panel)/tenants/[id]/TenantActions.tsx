'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Plan {
  id:     string
  nombre: string
}

interface Props {
  tenantId:            string
  estadoActual:        string
  nombre:              string
  ycloudConfigurado:   boolean
  creditosDisponibles: number
  planActualId?:       string | null
  planes:              Plan[]
  notasIniciales?:     string | null
}

type Panel = 'none' | 'creditos' | 'ycloud' | 'plan' | 'notas'

export default function TenantActions({
  tenantId, estadoActual, nombre, ycloudConfigurado,
  creditosDisponibles, planActualId, planes, notasIniciales,
}: Props) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [panel,   setPanel]   = useState<Panel>('none')
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Créditos
  const [creditos, setCreditos] = useState(500)
  const [motivo,   setMotivo]   = useState('recarga_manual')

  // Plan
  const [nuevoPlan, setNuevoPlan] = useState(planActualId ?? '')

  // Notas
  const [notas, setNotas] = useState(notasIniciales ?? '')

  // YCloud
  const [ycApiKey,        setYcApiKey]        = useState('')
  const [ycWebhookSecret, setYcWebhookSecret] = useState('')
  const [ycNumero,        setYcNumero]        = useState('')
  const [mostrarApiKey,   setMostrarApiKey]   = useState(false)

  function togglePanel(p: Panel) {
    setPanel(prev => prev === p ? 'none' : p)
    setError(null)
    setSuccess(null)
  }

  async function cambiarEstado(nuevoEstado: string) {
    if (!confirm(`¿Cambiar "${nombre}" a estado "${nuevoEstado}"?`)) return
    setLoading(true); setError(null)
    const res = await fetch(`/api/superadmin/tenants/${tenantId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_tenant: nuevoEstado }),
    })
    if (res.ok) { setSuccess(`Estado → ${nuevoEstado}`); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? 'Error') }
    setLoading(false)
  }

  async function agregarCreditos() {
    if (creditos <= 0) return
    setLoading(true); setError(null)
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/credits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditos, motivo }),
    })
    if (res.ok) { setSuccess(`+${creditos} créditos`); setPanel('none'); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? 'Error') }
    setLoading(false)
  }

  async function cambiarPlan() {
    if (!nuevoPlan || nuevoPlan === planActualId) return
    if (!confirm(`¿Cambiar el plan de "${nombre}"?`)) return
    setLoading(true); setError(null)
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/plan`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: nuevoPlan }),
    })
    if (res.ok) {
      const d = await res.json()
      setSuccess(`Plan → ${d.plan_nombre}`); setPanel('none'); router.refresh()
    } else {
      const d = await res.json(); setError(d.error ?? 'Error')
    }
    setLoading(false)
  }

  async function guardarNotas() {
    setLoading(true); setError(null)
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/notas`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notas_internas: notas.trim() || null }),
    })
    if (res.ok) { setSuccess('Notas guardadas'); setPanel('none'); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? 'Error') }
    setLoading(false)
  }

  async function guardarYCloud(e: React.FormEvent) {
    e.preventDefault()
    if (!ycApiKey.trim() && !ycloudConfigurado) { setError('La API Key es requerida'); return }
    if (!ycNumero.trim()) { setError('El número es requerido'); return }
    setLoading(true); setError(null)
    const body: Record<string, string> = { numero_whatsapp: ycNumero.trim() }
    if (ycApiKey.trim()) body.api_key = ycApiKey.trim()
    if (ycWebhookSecret.trim()) body.webhook_secret = ycWebhookSecret.trim()
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/ycloud`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { setSuccess('YCloud configurado'); setPanel('none'); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? 'Error guardando YCloud') }
    setLoading(false)
  }

  const planActualNombre = planes.find(p => p.id === planActualId)?.nombre

  return (
    <div className="flex flex-col gap-2 min-w-[280px]">
      {(error || success) && (
        <p className={`text-xs text-right ${error ? 'text-red-400' : 'text-green-400'}`}>
          {error || success}
        </p>
      )}

      {/* Botones principales */}
      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={() => togglePanel('creditos')}
          className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-sm hover:bg-gray-100 transition-colors font-medium">
          + Créditos
        </button>
        <button onClick={() => togglePanel('plan')}
          className="px-3 py-1.5 border border-indigo-600 text-indigo-300 rounded-lg text-sm hover:bg-indigo-900/30 transition-colors">
          {planActualNombre ? `Plan: ${planActualNombre}` : 'Cambiar plan'}
        </button>
        <button onClick={() => togglePanel('notas')}
          className="px-3 py-1.5 border border-gray-600 text-gray-300 rounded-lg text-sm hover:bg-gray-800 transition-colors">
          Notas
        </button>
        <button onClick={() => togglePanel('ycloud')}
          className="px-3 py-1.5 border border-gray-600 text-gray-300 rounded-lg text-sm hover:bg-gray-800 transition-colors">
          {ycloudConfigurado ? 'YCloud' : 'Configurar WA'}
        </button>
        {estadoActual !== 'activo' && (
          <button onClick={() => cambiarEstado('activo')} disabled={loading}
            className="px-3 py-1.5 border border-green-600 text-green-400 rounded-lg text-sm hover:bg-green-900/30 disabled:opacity-50 transition-colors">
            Activar
          </button>
        )}
        {estadoActual !== 'suspendido' && estadoActual !== 'cancelado' && (
          <button onClick={() => cambiarEstado('suspendido')} disabled={loading}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
            Suspender
          </button>
        )}
      </div>

      {/* Panel: Agregar créditos */}
      {panel === 'creditos' && (
        <div className="mt-2 p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Agregar créditos</p>
            <div className="text-right">
              <p className="text-xs text-gray-400">Saldo actual</p>
              <p className={`text-lg font-bold ${creditosDisponibles === 0 ? 'text-red-400' : creditosDisponibles < 100 ? 'text-yellow-400' : 'text-white'}`}>
                {creditosDisponibles.toLocaleString()} cr
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Cantidad rápida</label>
            <div className="grid grid-cols-4 gap-1">
              {[100, 500, 1000, 5000].map(n => (
                <button key={n} type="button" onClick={() => setCreditos(n)}
                  className={`py-1 rounded text-xs border transition-colors ${creditos === n ? 'bg-white text-gray-900 border-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400">O ingresa cantidad exacta</label>
            <input type="number" value={creditos} onChange={e => setCreditos(Number(e.target.value))}
              min={1} max={100000}
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          {creditos > 0 && (
            <p className="text-xs text-gray-500">
              Saldo resultante: <span className="text-white font-semibold">{(creditosDisponibles + creditos).toLocaleString()} cr</span>
            </p>
          )}
          <div>
            <label className="text-xs text-gray-400">Motivo</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="recarga_manual">Recarga manual</option>
              <option value="plan_mensual">Renovación plan mensual</option>
              <option value="compensacion">Compensación</option>
              <option value="trial">Trial gratuito</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={agregarCreditos} disabled={loading || creditos <= 0}
              className="flex-1 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 font-medium text-sm rounded-lg py-1.5 transition-colors">
              {loading ? 'Procesando...' : `Agregar ${creditos.toLocaleString()} cr`}
            </button>
            <button onClick={() => setPanel('none')} className="px-3 text-gray-400 hover:text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel: Cambiar plan */}
      {panel === 'plan' && (
        <div className="mt-2 p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
          <p className="text-sm font-medium text-white">Cambiar plan</p>
          <div>
            <label className="text-xs text-gray-400">Plan nuevo</label>
            <select value={nuevoPlan} onChange={e => setNuevoPlan(e.target.value)}
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">— Seleccionar —</option>
              {planes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.id === planActualId ? ' (actual)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={cambiarPlan} disabled={loading || !nuevoPlan || nuevoPlan === planActualId}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg py-1.5 transition-colors">
              {loading ? 'Cambiando...' : 'Aplicar cambio de plan'}
            </button>
            <button onClick={() => setPanel('none')} className="px-3 text-gray-400 hover:text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel: Notas internas */}
      {panel === 'notas' && (
        <div className="mt-2 p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
          <p className="text-sm font-medium text-white">Notas internas</p>
          <p className="text-xs text-gray-500">Solo visible para superadmins. No afecta al tenant.</p>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={4}
            placeholder="Historial de contacto, acuerdos, detalles de soporte..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          />
          <div className="flex gap-2">
            <button onClick={guardarNotas} disabled={loading}
              className="flex-1 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 text-sm font-medium rounded-lg py-1.5 transition-colors">
              {loading ? 'Guardando...' : 'Guardar notas'}
            </button>
            <button onClick={() => setPanel('none')} className="px-3 text-gray-400 hover:text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel: Configurar YCloud */}
      {panel === 'ycloud' && (
        <form onSubmit={guardarYCloud} className="mt-2 p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
          <p className="text-sm font-medium text-white">
            {ycloudConfigurado ? 'Actualizar YCloud' : 'Configurar YCloud'}
          </p>
          <div>
            <label className="text-xs text-gray-400">Número WhatsApp (sin +) *</label>
            <input type="text" value={ycNumero} onChange={e => setYcNumero(e.target.value)}
              placeholder="51987654321"
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="text-xs text-gray-400">
              API Key{!ycloudConfigurado ? ' *' : ' (vacío = mantener actual)'}
            </label>
            <div className="relative mt-1">
              <input type={mostrarApiKey ? 'text' : 'password'} value={ycApiKey}
                onChange={e => setYcApiKey(e.target.value)}
                placeholder={ycloudConfigurado ? '••••••••' : 'API Key de YCloud'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 pr-16 text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              <button type="button" onClick={() => setMostrarApiKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs">
                {mostrarApiKey ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400">Webhook Secret (vacío = mantener actual)</label>
            <input type="password" value={ycWebhookSecret} onChange={e => setYcWebhookSecret(e.target.value)}
              placeholder="••••••••"
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 font-medium text-sm rounded-lg py-1.5 transition-colors">
              {loading ? 'Guardando...' : 'Guardar YCloud'}
            </button>
            <button type="button" onClick={() => setPanel('none')} className="px-3 text-gray-400 hover:text-white text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
