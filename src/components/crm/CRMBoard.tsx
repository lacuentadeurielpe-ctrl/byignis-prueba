'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, MoreHorizontal, Building2, UserX, User, DollarSign, Calendar } from 'lucide-react'
import { HoverSpotlightCard } from '@/components/ui/HoverSpotlightCard'
import { cn, formatPEN, formatFecha } from '@/lib/utils'

interface Oportunidad {
  id: string
  titulo: string
  descripcion: string
  estado: string
  valor_estimado: number
  probabilidad_cierre: number
  fecha_cierre_estimada: string
  clientes: { id: string; nombre: string; alias: string; tipo: string }
}

const COLUMNAS = [
  { id: 'lead', label: 'Lead / Contacto', color: 'bg-zinc-200 text-zinc-700' },
  { id: 'negociacion', label: 'Negociación', color: 'bg-blue-200 text-blue-800' },
  { id: 'ganado', label: 'Cierre Ganado', color: 'bg-emerald-200 text-emerald-800' },
  { id: 'perdido', label: 'Perdido', color: 'bg-rose-200 text-rose-800' },
]

export default function CRMBoard({ oportunidades: inicial, clientes, userId }: { oportunidades: Oportunidad[], clientes: any[], userId: string }) {
  const [data, setData] = useState<Record<string, Oportunidad[]>>({
    lead: [],
    negociacion: [],
    ganado: [],
    perdido: [],
  })

  // Evitar error de hidratación de react-beautiful-dnd
  const [isBrowser, setIsBrowser] = useState(false)

  useEffect(() => {
    setIsBrowser(true)
    const agrupado = { lead: [], negociacion: [], ganado: [], perdido: [] } as Record<string, Oportunidad[]>
    inicial.forEach(op => {
      if (agrupado[op.estado]) agrupado[op.estado].push(op)
    })
    setData(agrupado)
  }, [inicial])

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Reordenamiento local optimista
    const sourceCol = data[source.droppableId]
    const destCol = data[destination.droppableId]
    const item = sourceCol[source.index]

    const newSourceCol = Array.from(sourceCol)
    newSourceCol.splice(source.index, 1)

    const newDestCol = Array.from(destCol)
    newDestCol.splice(destination.index, 0, { ...item, estado: destination.droppableId })

    setData({
      ...data,
      [source.droppableId]: newSourceCol,
      [destination.droppableId]: newDestCol
    })

    // Persistir en backend
    try {
      await fetch(`/api/crm/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: destination.droppableId })
      })
    } catch (e) {
      alert('Error moviendo la oportunidad')
      // Aquí se debería hacer rollback
    }
  }

  if (!isBrowser) return null

  return (
    <div className="h-full flex gap-4 overflow-x-auto pb-4 no-scrollbar">
      <DragDropContext onDragEnd={onDragEnd}>
        {COLUMNAS.map(col => (
          <div key={col.id} className="flex-shrink-0 w-80 flex flex-col bg-zinc-50/50 rounded-2xl border border-zinc-200/60 overflow-hidden">
            {/* Header Columna */}
            <div className="p-4 border-b border-zinc-200/60 flex items-center justify-between bg-zinc-100/30">
              <div className="flex items-center gap-2">
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', col.color)}>
                  {col.label}
                </span>
                <span className="text-xs font-bold text-zinc-400">
                  {data[col.id]?.length || 0}
                </span>
              </div>
              <button className="p-1 hover:bg-zinc-200 rounded-md text-zinc-400 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Zona Droppable */}
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'flex-1 p-3 overflow-y-auto space-y-3 transition-colors',
                    snapshot.isDraggingOver ? 'bg-indigo-50/50' : ''
                  )}
                >
                  {data[col.id]?.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            'outline-none',
                            snapshot.isDragging ? 'shadow-xl rotate-2 opacity-90' : 'opacity-100'
                          )}
                          style={provided.draggableProps.style}
                        >
                          <HoverSpotlightCard className="p-4 bg-white border border-zinc-200 shadow-sm cursor-grab active:cursor-grabbing">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-sm font-bold text-zinc-900 leading-tight">
                                {item.titulo}
                              </h4>
                              <button className="text-zinc-400 hover:text-zinc-700">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>

                            <p className="text-xs text-zinc-500 mb-4 line-clamp-2">
                              {item.descripcion || 'Sin descripción...'}
                            </p>

                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-5 h-5 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                                {item.clientes?.tipo === 'empresa' ? <Building2 className="w-3 h-3 text-zinc-500" /> : <User className="w-3 h-3 text-zinc-500" />}
                              </div>
                              <span className="text-xs font-medium text-zinc-700 truncate">
                                {item.clientes?.nombre || item.clientes?.alias}
                              </span>
                            </div>

                            <div className="border-t border-zinc-100 pt-3 mt-1 flex items-center justify-between">
                              <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                                {formatPEN(item.valor_estimado)}
                              </div>
                              {item.probabilidad_cierre > 0 && (
                                <div className="text-[10px] font-bold text-zinc-500 px-1.5 py-0.5 rounded-full border border-zinc-200">
                                  {item.probabilidad_cierre}%
                                </div>
                              )}
                            </div>
                          </HoverSpotlightCard>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </DragDropContext>
    </div>
  )
}
