'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatPEN, formatFecha } from '@/lib/utils'
import { Users, ChevronRight, Pencil, Building2, UserX, User } from 'lucide-react'
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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-violet-100/50 text-violet-700 border border-violet-200/50 uppercase">
      <Building2 className="w-3 h-3" /> Empresa
    </span>
  )
  if (tipo === 'anonimo') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase">
      <UserX className="w-3 h-3" /> Anónimo
    </span>
  )
  return null
}

function getAvatarProps(nombre: string | null, alias: string | null) {
  const text = (nombre || alias || '?').toUpperCase()
  const initial = text.charAt(0)
  // Generar un color determinista basado en la letra
  const colors = [
    'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700', 'bg-cyan-100 text-cyan-700'
  ]
  const colorIndex = text.charCodeAt(0) % colors.length
  return { initial, colorClass: colors[colorIndex] }
}

export default function ClientesTable({
  clientes: inicial,
  esDueno,
}: {
  clientes: ClienteResumen[]
  esDueno: boolean
}) {
  const [clientes, setClientes] = useState(inicial)
  const [editando, setEditando] = useState<ClienteResumen | null>(null)

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
      {clientes.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
          <p className="text-sm text-zinc-400">No hay clientes</p>
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
              {clientes.map((c) => {
                const avatar = getAvatarProps(c.nombre, c.alias)
                return (
                  <tr key={c.id} className="hover:bg-zinc-50/80 transition-all duration-200 group relative">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${avatar.colorClass}`}>
                          {avatar.initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link
                              href={`/dashboard/clientes/${c.id}`}
                              className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors"
                            >
                              {c.nombre || c.alias || '—'}
                            </Link>
                            <BadgeTipo tipo={c.tipo} />
                            {c.tags.length > 0 && c.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="px-1.5 py-0.5 rounded border border-zinc-200 bg-white text-[10px] font-medium text-zinc-600 shadow-sm">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {c.telefono && (
                              <p className="text-xs text-zinc-500 font-medium">+{c.telefono}</p>
                            )}
                            {c.alias && c.nombre && (
                              <p className="text-xs text-zinc-400 italic">"{c.alias}"</p>
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
                    <Link
                      href={`/dashboard/clientes/${c.id}?tab=historial`}
                      className="inline-block text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition"
                      title="Ver historial de pedidos"
                    >
                      {c.totalPedidos}
                    </Link>
                    {c.totalPedidos > c.pedidosCompletados && (
                      <span className="text-[10px] text-zinc-400 block">
                        ({c.totalPedidos - c.pedidosCompletados} cancel.)
                      </span>
                    )}
                  </td>

                  {esDueno && (
                    <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                      {c.totalGastado > 0 ? (
                        <Link
                          href={`/dashboard/clientes/${c.id}?tab=overview`}
                          className="inline-block text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition tabular-nums"
                          title="Ver resumen de gastos"
                        >
                          {formatPEN(c.totalGastado)}
                        </Link>
                      ) : (
                        <span className="text-zinc-300 font-normal">—</span>
                      )}
                    </td>
                  )}

                  <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                    {c.ultimoPedido ? (
                      <Link
                        href={`/dashboard/clientes/${c.id}?tab=historial`}
                        className="inline-block text-xs text-indigo-600 hover:text-indigo-700 hover:underline transition"
                        title="Ver historial de pedidos"
                      >
                        {formatFecha(c.ultimoPedido)}
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>

                    <td className="px-3 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {/* Botón editar ficha */}
                        <button
                          onClick={() => setEditando(c)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm bg-white border border-transparent hover:border-indigo-100"
                          title="Editar ficha del cliente"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Ver detalle */}
                        <Link
                          href={`/dashboard/clientes/${c.id}`}
                          className="p-2 rounded-xl text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm bg-white border border-transparent hover:border-indigo-100"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
