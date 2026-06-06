'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatPEN, formatFecha, matchesFuzzy } from '@/lib/utils'
import { Search, X, Users, ChevronRight, Pencil, Building2, UserX, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import EditarClienteModal from './EditarClienteModal'

type TipoCliente = 'persona' | 'empresa' | 'anonimo'

interface ClienteResumen {
  id: string
  nombre: string | null
  telefono: string | null
  dni_ruc: string | null
  tipo: TipoCliente
  alias: string | null
  email: string | null
  telefono_secundario: string | null
  direccion_habitual: string | null
  tags: string[]
  notas_internas: string | null
  created_at: string
  totalPedidos: number
  pedidosCompletados: number
  totalGastado: number
  ultimoPedido: string | null
}

function BadgeTipo({ tipo }: { tipo: TipoCliente }) {
  if (tipo === 'empresa') return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
      <Building2 className="w-2.5 h-2.5" /> Empresa
    </span>
  )
  if (tipo === 'anonimo') return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
      <UserX className="w-2.5 h-2.5" /> Anónimo
    </span>
  )
  return null // persona: no necesita badge, es el default
}

export default function ClientesTable({
  clientes: inicial,
  esDueno,
}: {
  clientes: ClienteResumen[]
  esDueno: boolean
}) {
  const [clientes, setClientes] = useState(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<ClienteResumen | null>(null)

  const filtrados = useMemo(() => {
    return clientes.filter((c) =>
      matchesFuzzy(
        `${c.nombre ?? ''} ${c.alias ?? ''} ${c.telefono ?? ''} ${c.dni_ruc ?? ''} ${c.tags.join(' ')}`,
        busqueda
      )
    )
  }, [clientes, busqueda])

  function handleGuardado(
    clienteId: string,
    actualizado: { nombre: string | null; alias: string | null; dni_ruc: string | null; tipo: TipoCliente }
  ) {
    setClientes((prev) =>
      prev.map((c) => c.id === clienteId ? { ...c, ...actualizado } : c)
    )
  }

  return (
    <div>
      {/* Búsqueda */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, alias, teléfono, DNI/RUC…"
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
          <p className="text-sm text-zinc-400">{busqueda ? 'Sin resultados' : 'No hay clientes aún'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[10px] uppercase tracking-wider">Cliente</th>
                <th className="text-left px-3 py-3 font-semibold text-zinc-400 text-[10px] uppercase tracking-wider hidden md:table-cell">DNI/RUC</th>
                <th className="text-center px-3 py-3 font-semibold text-zinc-400 text-[10px] uppercase tracking-wider">Pedidos</th>
                {esDueno && (
                  <th className="text-right px-4 py-3 font-semibold text-zinc-400 text-[10px] uppercase tracking-wider hidden sm:table-cell">Total comprado</th>
                )}
                <th className="text-right px-4 py-3 font-semibold text-zinc-400 text-[10px] uppercase tracking-wider hidden lg:table-cell">Último pedido</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtrados.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 transition group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-zinc-900">{c.nombre || c.alias || '—'}</p>
                          <BadgeTipo tipo={c.tipo} />
                          {c.tags.length > 0 && c.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {c.telefono && (
                            <p className="text-xs text-zinc-400 tabular-nums">+{c.telefono}</p>
                          )}
                          {c.alias && c.nombre && (
                            <p className="text-xs text-zinc-300 italic">"{c.alias}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 hidden md:table-cell">
                    {c.dni_ruc ? (
                      <span className="text-xs font-mono text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">
                        {c.tipo === 'empresa' ? 'RUC ' : 'DNI '}{c.dni_ruc}
                      </span>
                    ) : (
                      <span className="text-zinc-300 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-3 py-3.5 text-center">
                    <span className="text-sm font-bold text-zinc-700">{c.totalPedidos}</span>
                    {c.totalPedidos > c.pedidosCompletados && (
                      <span className="text-[10px] text-zinc-400 block">
                        ({c.totalPedidos - c.pedidosCompletados} cancel.)
                      </span>
                    )}
                  </td>

                  {esDueno && (
                    <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                      <span className="text-sm font-bold text-zinc-900 tabular-nums">
                        {c.totalGastado > 0 ? formatPEN(c.totalGastado) : <span className="text-zinc-300 font-normal">—</span>}
                      </span>
                    </td>
                  )}

                  <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                    <span className="text-xs text-zinc-400">
                      {c.ultimoPedido ? formatFecha(c.ultimoPedido) : '—'}
                    </span>
                  </td>

                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1">
                      {/* Botón editar ficha */}
                      <button
                        onClick={() => setEditando(c)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-blue-600 hover:bg-blue-50 transition opacity-0 group-hover:opacity-100"
                        title="Editar ficha del cliente"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Ver detalle */}
                      <Link
                        href={`/dashboard/clientes/${c.id}`}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-700 hover:bg-zinc-100 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {busqueda && (
            <p className="text-xs text-zinc-400 text-center py-3 border-t border-zinc-50">
              {filtrados.length} de {clientes.length} clientes
            </p>
          )}
        </div>
      )}

      {/* Modal editar ficha */}
      {editando && (
        <EditarClienteModal
          cliente={editando}
          onClose={() => setEditando(null)}
          onGuardado={(actualizado) => {
            handleGuardado(editando.id, actualizado)
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}
