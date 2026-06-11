'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Phone, MessageSquare, Mail, Building2, UserX, User, MapPin, Edit3, ShieldCheck, ShieldOff } from 'lucide-react'
import { cn, formatPEN, formatFecha } from '@/lib/utils'
import EditarClienteModal from '@/components/clientes/EditarClienteModal'
import TabOverview from './tabs/TabOverview'
import TabCuentaCorriente from './tabs/TabCuentaCorriente'
import TabHistorial from './tabs/TabHistorial'
import TabConversacion from './tabs/TabConversacion'
import TabNotas from './tabs/TabNotas'
import TabOportunidades from './tabs/TabOportunidades'

interface ClienteDetalleViewProps {
  cliente: any
  pedidos: any[]
  cotizaciones: any[]
  creditos: any[]
  conversacion: any
  oportunidades: any[]
  notas: any[]
  esDueno: boolean
  userId: string
}

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'cuenta', label: 'Deudas' },
  { id: 'historial', label: 'Historial' },
  { id: 'chat', label: 'Conversación' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'notas', label: 'Notas' },
] as const

export default function ClienteDetalleView({
  cliente: initCliente,
  pedidos,
  cotizaciones,
  creditos,
  conversacion,
  oportunidades,
  notas,
  esDueno,
  userId
}: ClienteDetalleViewProps) {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') || 'overview') as typeof TABS[number]['id']
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>(initialTab)
  const [cliente, setCliente] = useState(initCliente)
  const [modalEditar, setModalEditar] = useState(false)

  // deudaTotal es stateful para que se actualice cuando se registre un abono desde el tab
  const calcDeudaTotal = (c: any[]) =>
    c.filter(d => d.estado !== 'pagado').reduce((s: number, d: any) => s + Math.max(0, (d.monto_total ?? 0) - (d.monto_pagado ?? 0)), 0)
  const [deudaTotal, setDeudaTotal] = useState(() => calcDeudaTotal(creditos))
  const [limiteCredito, setLimiteCredito] = useState<number | null>(initCliente.limite_credito_monto ?? null)

  useEffect(() => {
    const tab = searchParams.get('tab') as typeof TABS[number]['id']
    if (tab && TABS.some(t => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const pedidosCompletados = pedidos.filter(p => p.estado !== 'cancelado')
  const totalGastado = pedidosCompletados.reduce((s, p) => s + (p.total || 0), 0)
  const LTV = totalGastado // Lifetime Value

  const whatsappUrl = cliente.telefono ? `https://wa.me/${cliente.telefono.replace(/\D/g, '')}` : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <div className="mb-6">
        <Link href="/dashboard/clientes" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
      </div>

      {/* Header Ficha Cliente */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden mb-6">
        <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div className="flex gap-5 items-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              {cliente.tipo === 'empresa' ? <Building2 className="w-8 h-8 text-indigo-500" /> : 
               cliente.tipo === 'anonimo' ? <UserX className="w-8 h-8 text-zinc-400" /> : 
               <User className="w-8 h-8 text-indigo-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-zinc-900 leading-none">
                  {cliente.nombre || cliente.alias || 'Sin nombre'}
                </h1>
                {cliente.tipo === 'empresa' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-700 uppercase tracking-wider">
                    Empresa
                  </span>
                )}
                {cliente.tipo === 'anonimo' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-600 uppercase tracking-wider">
                    Anónimo
                  </span>
                )}
                <button 
                  onClick={() => setModalEditar(true)}
                  className="p-1 text-zinc-400 hover:text-indigo-600 transition"
                  title="Editar ficha"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-x-4 gap-y-2 mt-2 flex-wrap text-sm text-zinc-500">
                {cliente.telefono && (
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +{cliente.telefono}</span>
                )}
                {cliente.dni_ruc && (
                  <span className="flex items-center gap-1.5 font-mono">
                    ID: {cliente.dni_ruc}
                  </span>
                )}
                {cliente.email && (
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {cliente.email}</span>
                )}
                {cliente.direccion_habitual && (
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {cliente.direccion_habitual}</span>
                )}
              </div>

              {cliente.tags?.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {cliente.tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & High-level metrics */}
          <div className="flex flex-col md:items-end gap-3 shrink-0">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white text-sm font-bold rounded-xl transition shadow-sm"
              >
                <MessageSquare className="w-4 h-4" /> Chat WhatsApp
              </a>
            )}
            {esDueno && (
              <div className="text-right mt-2 flex gap-4 flex-wrap justify-end">
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Deuda Actual</p>
                  <p className={cn("text-lg font-bold", deudaTotal > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {formatPEN(deudaTotal)}
                  </p>
                </div>
                {limiteCredito !== null && (() => {
                  const disponible = Math.max(0, limiteCredito - deudaTotal)
                  const sinCredito = disponible <= 0
                  return (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Crédito Disponible</p>
                      <p className={cn("text-lg font-bold flex items-center gap-1", sinCredito ? "text-rose-600" : "text-emerald-600")}>
                        {sinCredito ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        {formatPEN(disponible)}
                      </p>
                      <p className="text-[10px] text-zinc-400">de {formatPEN(limiteCredito)}</p>
                    </div>
                  )
                })()}
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">LTV (Compras)</p>
                  <p className="text-lg font-bold text-zinc-900">{formatPEN(LTV)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-t border-zinc-100 px-6 flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap",
                activeTab === tab.id 
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-200"
              )}
            >
              {tab.label}
              {tab.id === 'cuenta' && deudaTotal > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">!</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mb-12">
        {activeTab === 'overview' && (
          <TabOverview
            pedidos={pedidos}
            cotizaciones={cotizaciones}
            creditos={creditos}
            cliente={cliente}
            esDueno={esDueno}
            oportunidades={oportunidades}
          />
        )}
        {activeTab === 'cuenta' && (
          <TabCuentaCorriente
            creditos={creditos}
            clienteId={cliente.id}
            esDueno={esDueno}
            limiteCreditoInicial={limiteCredito}
            onDeudaUpdate={setDeudaTotal}
            onLimiteUpdate={setLimiteCredito}
          />
        )}
        {activeTab === 'historial' && (
          <TabHistorial 
            pedidos={pedidos} 
            cotizaciones={cotizaciones}
            esDueno={esDueno}
          />
        )}
        {activeTab === 'chat' && (
          <TabConversacion 
            conversacion={conversacion}
          />
        )}
        {activeTab === 'oportunidades' && (
          <TabOportunidades
            clienteId={cliente.id}
            oportunidadesIniciales={oportunidades}
            esDueno={esDueno}
          />
        )}
        {activeTab === 'notas' && (
          <TabNotas
            clienteId={cliente.id}
            notasCRM={notas}
            userId={userId}
            esDueno={esDueno}
          />
        )}
      </div>

      {modalEditar && (
        <EditarClienteModal
          cliente={cliente}
          onClose={() => setModalEditar(false)}
          onGuardado={(act) => setCliente({ ...cliente, ...act })}
        />
      )}
    </div>
  )
}
