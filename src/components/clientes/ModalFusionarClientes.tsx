'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, GitMerge, Loader2, Search, ArrowRight } from 'lucide-react'

interface ClienteSimple {
  id: string
  nombre: string | null
  telefono: string | null
  dni_ruc: string | null
}

interface Props {
  clientes: ClienteSimple[]
  onClose: () => void
}

export default function ModalFusionarClientes({ clientes, onClose }: Props) {
  const router = useRouter()
  const [paso, setPaso] = useState<1 | 2>(1)
  const [busquedaPrincipal, setBusquedaPrincipal] = useState('')
  const [busquedaSecundario, setBusquedaSecundario] = useState('')
  
  const [idPrincipal, setIdPrincipal] = useState<string | null>(null)
  const [idSecundario, setIdSecundario] = useState<string | null>(null)
  
  const [fusionando, setFusionando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const principalSeleccionado = clientes.find(c => c.id === idPrincipal)
  const secundarioSeleccionado = clientes.find(c => c.id === idSecundario)

  function buscar(q: string, excluirId: string | null) {
    if (!q.trim()) return []
    const lower = q.toLowerCase()
    return clientes
      .filter(c => c.id !== excluirId)
      .filter(c => 
        (c.nombre && c.nombre.toLowerCase().includes(lower)) ||
        (c.telefono && c.telefono.includes(lower)) ||
        (c.dni_ruc && c.dni_ruc.includes(lower))
      )
      .slice(0, 5)
  }

  async function fusionar() {
    if (!idPrincipal || !idSecundario) return
    if (!confirm('¿Estás seguro de fusionar estos clientes? Esta acción no se puede deshacer.')) return

    setFusionando(true)
    setError(null)
    try {
      const res = await fetch('/api/clientes/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idPrincipal, idSecundario })
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al fusionar')
      }

      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setFusionando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-bold text-zinc-900">Fusionar clientes duplicados</h2>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">El historial del secundario se moverá al principal.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {paso === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">1. Selecciona el cliente PRINCIPAL</label>
                <p className="text-xs text-zinc-500 mb-2">Este es el perfil que se mantendrá (nombre, datos, etc).</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    value={busquedaPrincipal}
                    onChange={(e) => {
                      setBusquedaPrincipal(e.target.value)
                      setIdPrincipal(null)
                    }}
                    placeholder="Buscar por nombre, teléfono o DNI..."
                    className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {!idPrincipal && busquedaPrincipal && (
                  <div className="mt-1 border border-zinc-100 rounded-lg shadow-sm overflow-hidden bg-white max-h-40 overflow-y-auto">
                    {buscar(busquedaPrincipal, null).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setIdPrincipal(c.id); setBusquedaPrincipal(c.nombre || c.telefono || 'Sin datos') }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 border-b border-zinc-50 last:border-0"
                      >
                        <span className="font-semibold text-zinc-900">{c.nombre || 'Sin nombre'}</span>
                        <span className="text-zinc-500 text-xs ml-2">({c.telefono || c.dni_ruc})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {idPrincipal && (
                <button
                  type="button"
                  onClick={() => setPaso(2)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition"
                >
                  Continuar
                </button>
              )}
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-indigo-700 uppercase">Cliente Principal (Destino)</p>
                  <p className="font-bold text-zinc-900">{principalSeleccionado?.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-zinc-500">{principalSeleccionado?.telefono || principalSeleccionado?.dni_ruc}</p>
                </div>
                <button onClick={() => setPaso(1)} className="text-xs text-indigo-600 hover:underline">Cambiar</button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">2. Selecciona el cliente SECUNDARIO</label>
                <p className="text-xs text-zinc-500 mb-2">Este perfil se ELIMINARÁ y sus pedidos/créditos pasarán al principal.</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    value={busquedaSecundario}
                    onChange={(e) => {
                      setBusquedaSecundario(e.target.value)
                      setIdSecundario(null)
                    }}
                    placeholder="Buscar por nombre, teléfono o DNI..."
                    className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                {!idSecundario && busquedaSecundario && (
                  <div className="mt-1 border border-zinc-100 rounded-lg shadow-sm overflow-hidden bg-white max-h-40 overflow-y-auto">
                    {buscar(busquedaSecundario, idPrincipal).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setIdSecundario(c.id); setBusquedaSecundario(c.nombre || c.telefono || 'Sin datos') }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50 border-b border-zinc-50 last:border-0"
                      >
                        <span className="font-semibold text-zinc-900">{c.nombre || 'Sin nombre'}</span>
                        <span className="text-zinc-500 text-xs ml-2">({c.telefono || c.dni_ruc})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {idSecundario && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                  <h4 className="text-sm font-bold text-rose-800 mb-2">Resumen de la Fusión</h4>
                  <div className="flex items-center gap-3 text-sm text-zinc-700">
                    <div className="flex-1 truncate line-through opacity-70">
                      {secundarioSeleccionado?.nombre || secundarioSeleccionado?.telefono}
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                    <div className="flex-1 truncate font-bold text-indigo-700">
                      {principalSeleccionado?.nombre || principalSeleccionado?.telefono}
                    </div>
                  </div>
                  <p className="text-xs text-rose-600 mt-3">
                    ⚠️ Se transferirán todos los pedidos, cotizaciones, créditos y conversaciones. El perfil secundario será eliminado definitivamente.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={fusionar}
                  disabled={!idPrincipal || !idSecundario || fusionando}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                >
                  {fusionando ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                  Confirmar Fusión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
