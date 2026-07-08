'use client'

import { useState, useEffect } from 'react'
import { Truck, Plus, Trash2, Copy, Check, ExternalLink, ChevronDown, ChevronUp, Shield, ShieldOff, Save } from 'lucide-react'

interface Repartidor {
  id: string
  nombre: string
  telefono: string
  pin: string
  token: string
  estado: string
  puede_registrar_deuda: boolean
}

// Estado local de edición de permisos para un repartidor
interface PermisosEdit {
  puede_registrar_deuda: boolean
}

export default function RepartidoresTab() {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [nombre, setNombre]             = useState('')
  const [telefono, setTelefono]         = useState('')
  const [isSaving, setIsSaving]         = useState(false)
  const [error, setError]               = useState('')
  const [copiado, setCopiado]           = useState<string | null>(null)
  const [generando, setGenerando]       = useState<string | null>(null)

  // Expansión + edición de permisos
  const [expandido, setExpandido]         = useState<string | null>(null)
  const [permisosEdit, setPermisosEdit]   = useState<Record<string, PermisosEdit>>({})
  const [guardandoPerm, setGuardandoPerm] = useState<string | null>(null)
  const [savedPerm, setSavedPerm]         = useState<string | null>(null)

  function getPortalUrl(token: string) {
    const base = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? '')
    return `${base}/delivery/${token}`
  }

  function initPermisosEdit(rep: Repartidor): PermisosEdit {
    return { puede_registrar_deuda: rep.puede_registrar_deuda ?? false }
  }

  function toggleExpandido(id: string, rep: Repartidor) {
    if (expandido === id) {
      setExpandido(null)
    } else {
      setExpandido(id)
      setPermisosEdit(prev => ({
        ...prev,
        [id]: prev[id] ?? initPermisosEdit(rep),
      }))
    }
  }

  async function generarToken(id: string) {
    setGenerando(id)
    try {
      const res = await fetch('/api/settings-2/equipo/repartidores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, accion: 'generar_token' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRepartidores(prev => prev.map(r => r.id === id ? { ...r, token: updated.token } : r))
      } else {
        setError('Error al generar el link de acceso')
      }
    } catch {
      setError('Error en la conexión')
    } finally {
      setGenerando(null)
    }
  }

  async function copiarLink(token: string) {
    const url = getPortalUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(token)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      prompt('Copia este link:', url)
    }
  }

  async function guardarPermisos(id: string) {
    const edit = permisosEdit[id]
    if (!edit) return

    setGuardandoPerm(id)
    setError('')

    try {
      const res = await fetch('/api/settings-2/equipo/repartidores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          accion:                'actualizar_permisos',
          puede_registrar_deuda: edit.puede_registrar_deuda,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setRepartidores(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
        setSavedPerm(id)
        setTimeout(() => setSavedPerm(null), 2500)
      } else {
        const err = await res.json()
        setError(err.error ?? 'Error al guardar permisos')
      }
    } catch {
      setError('Error en la conexión')
    } finally {
      setGuardandoPerm(null)
    }
  }

  useEffect(() => {
    fetchRepartidores()
  }, [])

  const fetchRepartidores = async () => {
    try {
      const res = await fetch('/api/settings-2/equipo/repartidores')
      if (res.ok) {
        const data = await res.json()
        setRepartidores(data)
      }
    } catch {
      setError('Error al cargar repartidores')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!nombre || !telefono) {
      setError('Nombre y teléfono son requeridos')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings-2/equipo/repartidores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono }),
      })
      if (res.ok) {
        const newRep = await res.json()
        setRepartidores([newRep, ...repartidores])
        setNombre('')
        setTelefono('')
        setShowForm(false)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al agregar')
      }
    } catch {
      setError('Error en la conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar repartidor?')) return
    try {
      const res = await fetch(`/api/settings-2/equipo/repartidores?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRepartidores(repartidores.filter(r => r.id !== id))
        if (expandido === id) setExpandido(null)
      } else {
        setError('Error al eliminar')
      }
    } catch {
      setError('Error en la conexión')
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-start gap-3">
          <span className="shrink-0 font-bold">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-zinc-900">Repartidores</h3>
          <p className="text-xs text-zinc-500 mt-1">{repartidores.length} repartidor{repartidores.length !== 1 ? 'es' : ''} en servicio</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl space-y-4">
          <input
            type="text"
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Teléfono (51987654321)"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-lg transition"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-lg transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {repartidores.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <Truck className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay repartidores aún</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega tu primer repartidor para comenzar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {repartidores.map(rep => {
            const isExp     = expandido === rep.id
            const edit      = permisosEdit[rep.id]
            const puedeDeuda = edit?.puede_registrar_deuda ?? rep.puede_registrar_deuda

            return (
              <div key={rep.id} className="rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                {/* Fila principal */}
                <div className="flex items-center gap-3 px-5 py-4 bg-white">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-indigo-600" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-900 text-sm">{rep.nombre}</span>
                      <code className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md">PIN {rep.pin}</code>
                      {puedeDeuda ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-md">
                          <Shield className="w-2.5 h-2.5" /> Acepta pago parcial
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[10px] font-medium rounded-md">
                          <ShieldOff className="w-2.5 h-2.5" /> Solo cobro completo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{rep.telefono}</p>
                  </div>

                  {/* Acciones rápidas */}
                  <div className="flex items-center gap-2 shrink-0">
                    {rep.token ? (
                      <>
                        <a
                          href={getPortalUrl(rep.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg font-medium transition"
                        >
                          <ExternalLink className="w-3 h-3" /> Portal
                        </a>
                        <button
                          onClick={() => copiarLink(rep.token)}
                          title="Copiar link"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition"
                        >
                          {copiado === rep.token
                            ? <><Check className="w-3 h-3 text-green-600" /><span className="text-green-600">¡Copiado!</span></>
                            : <><Copy className="w-3 h-3" />Copiar</>
                          }
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => generarToken(rep.id)}
                        disabled={generando === rep.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 disabled:opacity-50 transition"
                      >
                        {generando === rep.id ? (
                          <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ExternalLink className="w-3 h-3" />
                        )}
                        {generando === rep.id ? 'Generando...' : 'Generar link'}
                      </button>
                    )}

                    {/* Expandir permisos */}
                    <button
                      onClick={() => toggleExpandido(rep.id, rep)}
                      title="Configurar permisos de cobro"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 border border-zinc-200 transition"
                    >
                      Permisos {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => handleDelete(rep.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar repartidor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Panel de permisos (expandible) */}
                {isExp && edit && (
                  <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-5 space-y-5">
                    <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Permisos de cobro contraentrega</p>

                    {/* Toggle pago parcial */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Permitir pago parcial</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Si está activo, el repartidor puede entregar aunque el cliente pague solo una parte.
                          El resto queda como deuda registrada automáticamente.
                          El límite de crédito por cliente se configura en cada ficha de cliente.
                        </p>
                      </div>
                      <button
                        onClick={() => setPermisosEdit(prev => ({
                          ...prev,
                          [rep.id]: { ...prev[rep.id], puede_registrar_deuda: !prev[rep.id].puede_registrar_deuda },
                        }))}
                        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                          edit.puede_registrar_deuda ? 'bg-emerald-500' : 'bg-zinc-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          edit.puede_registrar_deuda ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Botón guardar */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => guardarPermisos(rep.id)}
                        disabled={guardandoPerm === rep.id}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 text-white rounded-xl transition"
                      >
                        {guardandoPerm === rep.id ? (
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : savedPerm === rep.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {guardandoPerm === rep.id ? 'Guardando...' : savedPerm === rep.id ? '¡Guardado!' : 'Guardar permisos'}
                      </button>
                      <button
                        onClick={() => {
                          setExpandido(null)
                          setPermisosEdit(prev => ({ ...prev, [rep.id]: initPermisosEdit(rep) }))
                        }}
                        className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition"
                      >
                        Cancelar
                      </button>
                    </div>
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
