'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, UserPlus, X, Loader2, Check } from 'lucide-react'
import { type Cliente } from '@/types/database'
import { toast } from 'sonner'
import { normalizarTelefono } from '@/lib/utils'

interface CustomerSelectorModalProps {
  ferreteriaId: string
  onClose: () => void
  onSelect: (cliente: Cliente | null) => void
}

export default function CustomerSelectorModal({ ferreteriaId, onClose, onSelect }: CustomerSelectorModalProps) {
  const supabase = createClient()
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  
  // Formulario nuevo cliente
  const [modoNuevo, setModoNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevoDoc, setNuevoDoc] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Búsqueda en vivo
  useEffect(() => {
    if (busqueda.length < 2) {
      setClientes([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('ferreteria_id', ferreteriaId)
        .or(`nombre.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%,dni_ruc.ilike.%${busqueda}%`)
        .order('nombre', { ascending: true })
        .limit(10)

      setClientes(data || [])
      setBuscando(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [busqueda, ferreteriaId])

  async function guardarNuevo() {
    if (!nuevoNombre.trim() || !nuevoTelefono.trim()) {
      toast.error('Nombre y teléfono son obligatorios')
      return
    }

    setGuardando(true)
    const tel = normalizarTelefono(nuevoTelefono)
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        ferreteria_id: ferreteriaId,
        nombre: nuevoNombre.trim(),
        telefono: tel,
        dni_ruc: nuevoDoc.trim() || null,
        tipo: 'persona'
      })
      .select('*')
      .single()

    setGuardando(false)
    if (error) {
      toast.error('Error al guardar cliente')
      return
    }
    
    toast.success('Cliente guardado')
    onSelect(data as Cliente)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-bold text-zinc-800 text-lg">
            {modoNuevo ? 'Nuevo Cliente' : 'Seleccionar Cliente'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {!modoNuevo ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  autoFocus
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, DNI, RUC o teléfono..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition font-medium"
                />
              </div>

              <div className="min-h-[200px] max-h-[300px] overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50/50 p-2 space-y-1">
                {buscando ? (
                  <div className="flex flex-col items-center justify-center h-32 text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-sm">Buscando...</span>
                  </div>
                ) : clientes.length > 0 ? (
                  clientes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelect(c)}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200 hover:shadow-sm transition text-left group"
                    >
                      <div>
                        <p className="font-bold text-zinc-800 text-sm group-hover:text-zinc-900">{c.nombre}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {c.dni_ruc && <span className="font-mono bg-zinc-100 px-1 rounded mr-2">{c.dni_ruc}</span>}
                          {c.telefono}
                        </p>
                      </div>
                      <Check className="w-5 h-5 text-emerald-500 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  ))
                ) : busqueda.length >= 2 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-zinc-500 space-y-3">
                    <p className="text-sm">No se encontró a "{busqueda}"</p>
                    <button 
                      onClick={() => { setNuevoNombre(busqueda); setModoNuevo(true) }}
                      className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition"
                    >
                      Registrar como nuevo
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-zinc-400">
                    <p className="text-sm">Escribe para buscar clientes registrados</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button 
                  onClick={() => onSelect(null)} 
                  className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition"
                >
                  Continuar como Mostrador
                </button>
                <button 
                  onClick={() => setModoNuevo(true)}
                  className="flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 px-4 py-2 hover:bg-zinc-100 rounded-lg transition"
                >
                  <UserPlus className="w-4 h-4" /> Nuevo Cliente
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nombre / Razón Social *</label>
                <input
                  autoFocus
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Teléfono *</label>
                  <input
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    placeholder="999888777"
                    className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">DNI / RUC</label>
                  <input
                    value={nuevoDoc}
                    onChange={(e) => setNuevoDoc(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 mt-6">
                <button 
                  onClick={() => setModoNuevo(false)}
                  disabled={guardando}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
                >
                  Atrás
                </button>
                <button 
                  onClick={guardarNuevo}
                  disabled={guardando}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition disabled:opacity-50"
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Guardar y Seleccionar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
