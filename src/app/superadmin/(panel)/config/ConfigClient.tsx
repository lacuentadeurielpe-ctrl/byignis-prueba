'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ConfigEntry {
  clave:         string
  valor:         unknown
  descripcion:   string | null
  actualizado_at: string
}

interface Props {
  config: ConfigEntry[]
}

const GRUPOS: Record<string, string[]> = {
  'Créditos por tarea': [
    'creditos_respuesta', 'creditos_crm_faq', 'creditos_cotizacion', 'creditos_pedido',
    'creditos_audio', 'creditos_imagen', 'creditos_inventario', 'creditos_reporte_ia',
    'creditos_orquestador', 'creditos_bienvenida',
  ],
  'Modelos IA': [
    'modelo_default_bot', 'modelo_default_orquestador', 'modelo_default_audio', 'modelo_default_vision',
  ],
  'Finanzas': ['tipo_cambio_usd_pen'],
  'Bot & Mantenimiento': ['modo_mantenimiento', 'mensaje_mantenimiento', 'mensaje_creditos_agotados'],
}

function valorAString(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

export default function ConfigClient({ config }: Props) {
  const router = useRouter()
  const configMap = Object.fromEntries(config.map(c => [c.clave, c]))

  const [editando, setEditando] = useState<string | null>(null)
  const [valor,    setValor]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  function abrirEditar(clave: string) {
    const entry = configMap[clave]
    if (!entry) return
    setEditando(clave)
    setValor(valorAString(entry.valor))
    setError(null); setSuccess(null)
  }

  async function guardar(clave: string) {
    setLoading(true); setError(null)

    // Intentar parsear como JSON para enviar el tipo correcto
    let valorParsed: unknown = valor
    try { valorParsed = JSON.parse(valor) } catch { valorParsed = valor }

    const res = await fetch('/api/superadmin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, valor: valorParsed }),
    })

    if (res.ok) {
      setSuccess(`${clave} actualizado`)
      setEditando(null)
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error guardando')
    }
    setLoading(false)
  }

  const esBool = (v: unknown) => typeof v === 'boolean' || v === 'true' || v === 'false'

  return (
    <div className="space-y-6">
      {(error || success) && (
        <div className={`px-4 py-2 rounded-lg text-sm ${error ? 'bg-red-950/30 border border-red-800 text-red-300' : 'bg-green-950/30 border border-green-800 text-green-300'}`}>
          {error || success}
        </div>
      )}

      {Object.entries(GRUPOS).map(([grupo, claves]) => (
        <div key={grupo} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-400">{grupo}</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {claves.map(clave => {
              const entry = configMap[clave]
              if (!entry) return null
              const isEditing = editando === clave
              const isBool    = esBool(entry.valor)
              const isModo    = clave === 'modo_mantenimiento'

              return (
                <div key={clave} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-white">{clave}</p>
                      {entry.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5">{entry.descripcion}</p>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 shrink-0">
                        {isBool ? (
                          <select value={valor} onChange={e => setValor(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-24">
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input type="text" value={valor} onChange={e => setValor(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-48 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                        )}
                        <button onClick={() => guardar(clave)} disabled={loading}
                          className="px-2 py-1 bg-white text-gray-900 text-xs rounded hover:bg-gray-100 disabled:opacity-40">
                          {loading ? '...' : 'OK'}
                        </button>
                        <button onClick={() => setEditando(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 shrink-0">
                        {isModo && entry.valor === true && (
                          <span className="text-xs bg-red-900/40 text-red-400 border border-red-700 px-2 py-0.5 rounded-full font-medium">
                            ACTIVO
                          </span>
                        )}
                        <span className={`font-mono text-sm ${
                          entry.valor === true  ? 'text-yellow-400' :
                          entry.valor === false ? 'text-gray-500' :
                          'text-indigo-300'
                        }`}>
                          {valorAString(entry.valor).slice(0, 40)}
                        </span>
                        <button onClick={() => abrirEditar(clave)}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                          Editar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
