'use client'

import { useState } from 'react'
import { UserPlus, GitMerge } from 'lucide-react'
import ModalFusionarClientes from './ModalFusionarClientes'
// Assuming we have EditarClienteModal for creating new clients as well, or we can reuse it
import EditarClienteModal from './EditarClienteModal'

interface ClienteSimple {
  id: string
  nombre: string | null
  telefono: string | null
  dni_ruc: string | null
  tipo: 'persona' | 'empresa' | 'anonimo'
  alias: string | null
  email: string | null
  telefono_secundario: string | null
  direccion_habitual: string | null
  tags: string[]
  notas_internas: string | null
}

interface Props {
  esDueno: boolean
  clientes: ClienteSimple[]
}

export default function ClientesPageActions({ esDueno, clientes }: Props) {
  const [modalFusionar, setModalFusionar] = useState(false)
  const [modalNuevo, setModalNuevo] = useState(false)

  // Para reutilizar EditarClienteModal, le pasamos un "cliente vacío" 
  // O en el futuro crear un ModalNuevoCliente específico.
  // Por ahora lo simplificaremos.

  return (
    <>
      <div className="flex items-center gap-2">
        {esDueno && (
          <button
            onClick={() => setModalFusionar(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-sm font-medium transition shadow-sm"
          >
            <GitMerge className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">Fusionar clientes</span>
          </button>
        )}
        {/* Futuro: Añadir cliente manual directamente aquí */}
        {/* <button
          onClick={() => setModalNuevo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-medium transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo cliente</span>
        </button> */}
      </div>

      {modalFusionar && (
        <ModalFusionarClientes
          clientes={clientes}
          onClose={() => setModalFusionar(false)}
        />
      )}
    </>
  )
}
