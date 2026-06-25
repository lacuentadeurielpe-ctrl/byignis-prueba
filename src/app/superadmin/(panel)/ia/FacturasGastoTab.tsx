'use client'

import { useEffect, useState } from 'react'
import { FileText, RefreshCw, CheckCircle, Archive, ChevronDown, ChevronUp } from 'lucide-react'

interface DesgloseModelo {
  llamadas:       number
  tokens_entrada: number
  tokens_salida:  number
  costo_usd:      number
}

interface DesgloseT {
  nombre:    string
  llamadas:  number
  costo_usd: number
}

interface Factura {
  id:              string
  numero:          string | null
  periodo_inicio:  string
  periodo_fin:     string
  total_usd:       number
  total_llamadas:  number
  total_tokens:    number
  desglose_modelo: Record<string, DesgloseModelo>
  desglose_tenant: Record<string, DesgloseT>
  estado:          string
  notas:           string | null
  generada_at:     string
  emitida_at:      string | null
}

const ESTADO_CONFIG = {
  borrador: { label: 'Borrador',  bg: 'bg-gray-800',       text: 'text-gray-400'  },
  emitida:  { label: 'Emitida',   bg: 'bg-blue-900/40',    text: 'text-blue-300'  },
  archivada:{ label: 'Archivada', bg: 'bg-gray-900',        text: 'text-gray-600'  },
}

export default function FacturasGastoTab() {
  const [facturas, setFacturas]       = useState<Factura[]>([])
  const [loading, setLoading]         = useState(true)
  const [expandId, setExpandId]       = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [genForm, setGenForm]         = useState({
    periodo_inicio: primerDiaMes(),
    periodo_fin:    hoyLima(),
    notas: '',
  })
  const [showGen, setShowGen]         = useState(false)

  function primerDiaMes(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  function hoyLima(): string {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }))
      .toISOString().slice(0, 10)
  }

  async function cargar() {
    setLoading(true)
    const res = await fetch('/api/superadmin/ia/facturas')
    const json = await res.json()
    setFacturas(json.facturas ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function generar() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/superadmin/ia/facturas/generar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genForm),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false)
    setShowGen(false)
    cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    setSaving(true)
    const res = await fetch(`/api/superadmin/ia/facturas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error)
    }
    setSaving(false)
    cargar()
  }

  if (loading) return <p className="text-gray-500 text-sm py-6">Cargando facturas...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white">Facturas de gasto IA</h2>
          <p className="text-xs text-gray-500 mt-0.5">Documentos internos de lo que pagamos a los proveedores por período</p>
        </div>
        <button
          onClick={() => { setShowGen(!showGen); setError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Generar factura
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Formulario generación */}
      {showGen && (
        <div className="mb-4 bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-300">Generar factura de gasto</p>
          <p className="text-xs text-gray-500">
            Agrega todos los movimientos IA del período seleccionado y genera un documento con el desglose por modelo y por tenant.
            Si ya existe una factura para ese mes, se regenera.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Inicio período</label>
              <input
                type="date"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={genForm.periodo_inicio}
                onChange={(e) => setGenForm(f => ({ ...f, periodo_inicio: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fin período</label>
              <input
                type="date"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={genForm.periodo_fin}
                onChange={(e) => setGenForm(f => ({ ...f, periodo_fin: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notas</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="ej. Junio 2026"
                value={genForm.notas}
                onChange={(e) => setGenForm(f => ({ ...f, notas: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generar}
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
            >
              {saving ? 'Generando…' : 'Generar'}
            </button>
            <button
              onClick={() => setShowGen(false)}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de facturas */}
      {facturas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-10 text-center text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin facturas generadas aún.</p>
          <p className="text-xs mt-1">Haz clic en "Generar factura" para crear la primera.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {facturas.map((f) => {
            const cfg      = ESTADO_CONFIG[f.estado as keyof typeof ESTADO_CONFIG] ?? ESTADO_CONFIG.borrador
            const expanded = expandId === f.id
            const modelos  = Object.entries(f.desglose_modelo ?? {}).sort((a, b) => b[1].costo_usd - a[1].costo_usd)
            const tenants  = Object.entries(f.desglose_tenant ?? {}).sort((a, b) => b[1].costo_usd - a[1].costo_usd).slice(0, 10)

            return (
              <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Cabecera */}
                <div
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpandId(expanded ? null : f.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-white">
                        {f.numero ?? 'Sin número'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {f.periodo_inicio} → {f.periodo_fin}
                      {f.notas && <span className="ml-2 text-gray-600">· {f.notas}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">${Number(f.total_usd).toFixed(4)}</p>
                    <p className="text-xs text-gray-500">{f.total_llamadas.toLocaleString()} llamadas · {(f.total_tokens / 1_000_000).toFixed(2)}M tokens</p>
                  </div>
                  <div className="text-gray-500">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Detalle expandido */}
                {expanded && (
                  <div className="border-t border-gray-800 px-5 py-4 space-y-5">
                    {/* Acciones */}
                    <div className="flex gap-2">
                      {f.estado === 'borrador' && (
                        <button
                          onClick={() => cambiarEstado(f.id, 'emitida')}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Marcar emitida
                        </button>
                      )}
                      {f.estado !== 'archivada' && (
                        <button
                          onClick={() => cambiarEstado(f.id, 'archivada')}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archivar
                        </button>
                      )}
                      {f.estado !== 'archivada' && (
                        <button
                          onClick={generar}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
                          title="Regenera esta factura con los datos actuales del período"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Regenerar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Desglose por modelo */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-400 mb-2">Desglose por modelo</h4>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 text-left border-b border-gray-800">
                              <th className="pb-1.5 font-medium">Modelo</th>
                              <th className="pb-1.5 font-medium text-right">Llamadas</th>
                              <th className="pb-1.5 font-medium text-right">Tokens</th>
                              <th className="pb-1.5 font-medium text-right">Costo USD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/50">
                            {modelos.map(([modelo, d]) => (
                              <tr key={modelo} className="hover:bg-gray-800/20">
                                <td className="py-1.5 font-mono text-gray-300">{modelo}</td>
                                <td className="py-1.5 text-right text-gray-400">{d.llamadas.toLocaleString()}</td>
                                <td className="py-1.5 text-right text-gray-400">
                                  {((d.tokens_entrada + d.tokens_salida) / 1000).toFixed(0)}K
                                </td>
                                <td className="py-1.5 text-right text-green-400 font-medium">
                                  ${d.costo_usd.toFixed(4)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-700 text-right font-semibold">
                              <td colSpan={3} className="pt-2 text-gray-400 text-left">Total</td>
                              <td className="pt-2 text-green-400">${Number(f.total_usd).toFixed(4)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Top tenants */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-400 mb-2">Top tenants (por costo)</h4>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 text-left border-b border-gray-800">
                              <th className="pb-1.5 font-medium">Negocio</th>
                              <th className="pb-1.5 font-medium text-right">Llamadas</th>
                              <th className="pb-1.5 font-medium text-right">Costo USD</th>
                              <th className="pb-1.5 font-medium text-right">% total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/50">
                            {tenants.map(([fid, d]) => (
                              <tr key={fid} className="hover:bg-gray-800/20">
                                <td className="py-1.5 text-gray-300 truncate max-w-[120px]">{d.nombre}</td>
                                <td className="py-1.5 text-right text-gray-400">{d.llamadas.toLocaleString()}</td>
                                <td className="py-1.5 text-right text-green-400">${d.costo_usd.toFixed(4)}</td>
                                <td className="py-1.5 text-right text-gray-500">
                                  {f.total_usd > 0 ? `${((d.costo_usd / Number(f.total_usd)) * 100).toFixed(1)}%` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {f.emitida_at && (
                      <p className="text-xs text-gray-600">
                        Emitida el {new Date(f.emitida_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
