'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Tenant {
  id:               string
  nombre:           string
  telefono_whatsapp: string
  estado_tenant:    string
  created_at:       string
  plan_nombre:      string | null
  plan_id:          string | null
  creditos_disp:    number
  creditos_mes:     number
  mrr:              number
  proveedor_wa:     'meta' | 'ycloud' | 'ninguno'
}

interface Plan {
  id:     string
  nombre: string
}

interface Props {
  tenants:        Tenant[]
  planes:         Plan[]
  filtroInicial?: string
}

const ESTADO_COLORS: Record<string, string> = {
  activo:     'bg-green-500/10 text-green-400 border border-green-700',
  trial:      'bg-yellow-500/10 text-yellow-400 border border-yellow-700',
  suspendido: 'bg-red-500/10 text-red-400 border border-red-700',
  cancelado:  'bg-gray-800 text-gray-500 border border-gray-700',
}

export default function TenantsClient({ tenants, planes, filtroInicial = '' }: Props) {
  const router = useRouter()
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPlan, setFiltroPlan]   = useState('')
  const [filtroRiesgo, setFiltroRiesgo] = useState(filtroInicial === 'riesgo')
  const [busqueda, setBusqueda]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [bulkPanel, setBulkPanel]     = useState<'none' | 'creditos' | 'plan' | 'suspender'>('none')
  const [bulkCreditos, setBulkCreditos] = useState(500)
  const [bulkPlan, setBulkPlan]       = useState('')

  const filtrados = useMemo(() => {
    return tenants.filter(t => {
      if (filtroEstado && t.estado_tenant !== filtroEstado) return false
      if (filtroPlan && t.plan_id !== filtroPlan) return false
      if (filtroRiesgo) {
        const pct = t.creditos_mes > 0 ? t.creditos_disp / t.creditos_mes : 1
        if (pct >= 0.20) return false
      }
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (!t.nombre.toLowerCase().includes(q) && !t.telefono_whatsapp.includes(q)) return false
      }
      return true
    })
  }, [tenants, filtroEstado, filtroPlan, filtroRiesgo, busqueda])

  function toggleAll() {
    if (selected.size === filtrados.length) setSelected(new Set())
    else setSelected(new Set(filtrados.map(t => t.id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exportarCSV() {
    const ids = selected.size > 0 ? filtrados.filter(t => selected.has(t.id)) : filtrados
    const rows = [
      ['Nombre', 'Teléfono', 'Estado', 'Plan', 'Créditos', 'MRR (S/)', 'Registrado'],
      ...ids.map(t => [
        t.nombre,
        t.telefono_whatsapp,
        t.estado_tenant,
        t.plan_nombre ?? '—',
        t.creditos_disp,
        t.mrr,
        new Date(t.created_at).toLocaleDateString('es-PE'),
      ]),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'tenants.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function ejecutarBulk(accion: string, extra?: Record<string, unknown>) {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (!confirm(`¿Aplicar "${accion}" a ${ids.length} tenant(s)?`)) return
    setLoading(true); setError(null)
    const res = await fetch('/api/superadmin/tenants/bulk', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ accion, ids, ...extra }),
    })
    if (res.ok) {
      setBulkPanel('none')
      setSelected(new Set())
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error ejecutando acción')
    }
    setLoading(false)
  }

  const creditosPct = (t: Tenant) =>
    t.creditos_mes > 0 ? Math.round((t.creditos_disp / t.creditos_mes) * 100) : 100

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-gray-400 text-sm mt-1">{filtrados.length} de {tenants.length} ferreterías</p>
        </div>
        <button onClick={exportarCSV}
          className="px-3 py-1.5 text-xs border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Buscar por nombre o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-64"
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="trial">Trial</option>
          <option value="suspendido">Suspendido</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select value={filtroPlan} onChange={e => setFiltroPlan(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none">
          <option value="">Todos los planes</option>
          {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <button
          onClick={() => setFiltroRiesgo(v => !v)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${filtroRiesgo ? 'bg-red-900/40 border-red-700 text-red-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
          ⚠️ Solo en riesgo (&lt;20%)
        </button>
        {(filtroEstado || filtroPlan || filtroRiesgo || busqueda) && (
          <button onClick={() => { setFiltroEstado(''); setFiltroPlan(''); setFiltroRiesgo(false); setBusqueda('') }}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Barra bulk */}
      {selected.size > 0 && (
        <div className="mb-4 bg-indigo-950/40 border border-indigo-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-indigo-300 font-medium">{selected.size} seleccionado(s)</span>
            <button onClick={() => setBulkPanel(bulkPanel === 'creditos' ? 'none' : 'creditos')}
              className="px-3 py-1 text-xs bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-medium">
              + Créditos
            </button>
            <button onClick={() => setBulkPanel(bulkPanel === 'plan' ? 'none' : 'plan')}
              className="px-3 py-1 text-xs border border-indigo-600 text-indigo-300 rounded-lg hover:bg-indigo-900/40 transition-colors">
              Cambiar plan
            </button>
            <button onClick={() => ejecutarBulk('suspender')} disabled={loading}
              className="px-3 py-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-40">
              Suspender
            </button>
            <button onClick={() => ejecutarBulk('activar')} disabled={loading}
              className="px-3 py-1 text-xs border border-green-700 text-green-400 rounded-lg hover:bg-green-900/20 transition-colors disabled:opacity-40">
              Activar
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:text-gray-300">
              Cancelar
            </button>
          </div>

          {/* Sub-panel créditos */}
          {bulkPanel === 'creditos' && (
            <div className="mt-3 pt-3 border-t border-indigo-800 flex items-center gap-3">
              <label className="text-xs text-gray-400">Cantidad:</label>
              <div className="flex gap-1">
                {[100, 500, 1000, 5000].map(n => (
                  <button key={n} onClick={() => setBulkCreditos(n)}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${bulkCreditos === n ? 'bg-white text-gray-900 border-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
              <input type="number" value={bulkCreditos} onChange={e => setBulkCreditos(Number(e.target.value))}
                min={1} className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-xs text-white" />
              <button onClick={() => ejecutarBulk('agregar_creditos', { creditos: bulkCreditos, motivo: 'recarga_manual' })}
                disabled={loading || bulkCreditos <= 0}
                className="px-3 py-1 text-xs bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                {loading ? '...' : `Agregar ${bulkCreditos.toLocaleString()} cr`}
              </button>
            </div>
          )}

          {/* Sub-panel cambiar plan */}
          {bulkPanel === 'plan' && (
            <div className="mt-3 pt-3 border-t border-indigo-800 flex items-center gap-3">
              <label className="text-xs text-gray-400">Nuevo plan:</label>
              <select value={bulkPlan} onChange={e => setBulkPlan(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-xs text-white">
                <option value="">Seleccionar...</option>
                {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <button onClick={() => ejecutarBulk('cambiar_plan', { plan_id: bulkPlan })}
                disabled={loading || !bulkPlan}
                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-40">
                {loading ? '...' : 'Aplicar'}
              </button>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 w-8">
                <input type="checkbox"
                  checked={selected.size === filtrados.length && filtrados.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-600 bg-gray-800 accent-indigo-500" />
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Ferretería</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">WA</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Plan</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Créditos</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">MRR</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Registrado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-500">
                  No hay tenants con estos filtros
                </td>
              </tr>
            )}
            {filtrados.map(t => {
              const pct       = creditosPct(t)
              const enRiesgo  = pct < 20
              const fechaReg  = new Date(t.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })

              return (
                <tr key={t.id}
                  className={`hover:bg-gray-800/50 transition-colors ${selected.has(t.id) ? 'bg-indigo-950/20' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)}
                      className="rounded border-gray-600 bg-gray-800 accent-indigo-500" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white text-sm">{t.nombre}</div>
                    <div className="text-xs text-gray-500 font-mono">{t.telefono_whatsapp}</div>
                  </td>
                  <td className="px-4 py-3">
                    {t.proveedor_wa === 'meta' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-900/40 text-blue-300 border border-blue-700 font-medium">
                        Meta
                      </span>
                    )}
                    {t.proveedor_wa === 'ycloud' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-900/40 text-purple-300 border border-purple-700 font-medium">
                        YCloud
                      </span>
                    )}
                    {t.proveedor_wa === 'ninguno' && (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{t.plan_nombre ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${ESTADO_COLORS[t.estado_tenant] ?? ''}`}>
                      {t.estado_tenant}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-medium ${enRiesgo ? 'text-red-400' : pct < 50 ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {pct}%
                      </span>
                      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${enRiesgo ? 'bg-red-500' : pct < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{t.creditos_disp.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {t.mrr > 0 ? `S/ ${t.mrr.toFixed(0)}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fechaReg}</td>
                  <td className="px-4 py-3">
                    <Link href={`/superadmin/tenants/${t.id}`}
                      className="text-indigo-400 hover:text-indigo-300 text-xs">
                      Ver →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
