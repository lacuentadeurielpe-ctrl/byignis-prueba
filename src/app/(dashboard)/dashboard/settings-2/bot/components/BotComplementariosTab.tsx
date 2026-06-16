'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Trash2, Search, Box, FileDown, X } from 'lucide-react'
import { matchesFuzzy } from '@/lib/utils'

type TipoCatalogo = 'fisico' | 'digital'

interface Opcion {
  id: string
  nombre: string
  tipo: TipoCatalogo
  searchText: string
  precio?: number | null
  categoria?: string | null
}

interface Par {
  id: string
  activo: boolean
  producto: { id: string; tipo: TipoCatalogo; nombre: string }
  complementario: { id: string; tipo: TipoCatalogo; nombre: string }
}

function Badge({ tipo }: { tipo: TipoCatalogo }) {
  return tipo === 'digital' ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 rounded shrink-0">
      <FileDown className="w-2.5 h-2.5" /> Digital
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 rounded shrink-0">
      <Box className="w-2.5 h-2.5" /> Físico
    </span>
  )
}

// Catálogo combinado (físico + digital) cargado una sola vez para ambos pickers —
// igual al patrón de ProductsTable: todo en memoria, filtrado instantáneo con matchesFuzzy.
function ProductoPicker({
  placeholder,
  catalogo,
  cargandoCatalogo,
  excluirId,
  onSelect,
  selected,
}: {
  placeholder: string
  catalogo: Opcion[]
  cargandoCatalogo: boolean
  excluirId?: string
  onSelect: (op: Opcion | null) => void
  selected: Opcion | null
}) {
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const resultados = useMemo(() => {
    const base = excluirId ? catalogo.filter(o => o.id !== excluirId) : catalogo
    if (!query.trim()) return base.slice(0, 8)
    return base.filter(o => matchesFuzzy(o.searchText, query)).slice(0, 8)
  }, [catalogo, query, excluirId])

  useEffect(() => { setActiveIndex(0) }, [resultados])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function elegir(op: Opcion) {
    onSelect(op)
    setAbierto(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!abierto) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const op = resultados[activeIndex]; if (op) elegir(op) }
    else if (e.key === 'Escape') { setAbierto(false) }
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50">
        <Badge tipo={selected.tipo} />
        <span className="text-sm text-zinc-900 flex-1 truncate" title={selected.nombre}>{selected.nombre}</span>
        <button onClick={() => onSelect(null)} className="text-zinc-400 hover:text-rose-600 shrink-0" title="Quitar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onKeyDown={onKeyDown}
          placeholder={cargandoCatalogo ? 'Cargando catálogo...' : placeholder}
          disabled={cargandoCatalogo}
          className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-zinc-50 disabled:cursor-wait"
        />
      </div>

      {abierto && !cargandoCatalogo && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="px-3 py-3 text-xs text-zinc-400 text-center">
              {query ? `Sin resultados para "${query}"` : 'Sin productos en el catálogo'}
            </p>
          ) : (
            resultados.map((op, idx) => (
              <button
                key={`${op.tipo}-${op.id}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => elegir(op)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
                  idx === activeIndex ? 'bg-indigo-50' : 'hover:bg-zinc-50'
                }`}
              >
                <Badge tipo={op.tipo} />
                <span className="text-sm text-zinc-800 truncate flex-1">{op.nombre}</span>
                {op.categoria && <span className="text-[10px] text-zinc-400 shrink-0">{op.categoria}</span>}
                {op.precio != null && <span className="text-xs font-medium text-zinc-500 tabular-nums shrink-0">S/{op.precio.toFixed(2)}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function BotComplementariosTab() {
  const [items, setItems] = useState<Par[]>([])
  const [catalogo, setCatalogo] = useState<Opcion[]>([])
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productoSel, setProductoSel] = useState<Opcion | null>(null)
  const [complementarioSel, setComplementarioSel] = useState<Opcion | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings-2/bot/complementarios')
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const cargarCatalogo = async () => {
    setCargandoCatalogo(true)
    try {
      const [fisicos, digitales] = await Promise.all([
        fetch('/api/products?activos=true').then(r => r.ok ? r.json() : []),
        fetch('/api/catalog/digital').then(r => r.ok ? r.json() : []),
      ])

      const fis: Opcion[] = (fisicos ?? []).map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        tipo: 'fisico' as const,
        precio: p.precio_base,
        categoria: p.categorias?.nombre ?? null,
        searchText: `${p.nombre} ${p.descripcion ?? ''} ${p.marca ?? ''} ${p.proveedor ?? ''} ${p.codigo_barras ?? ''} ${p.codigo_interno ?? ''}`,
      }))

      const dig: Opcion[] = (digitales ?? []).filter((d: any) => d.activo).map((d: any) => ({
        id: d.id,
        nombre: d.nombre,
        tipo: 'digital' as const,
        precio: d.precio,
        categoria: d.categoria ?? null,
        searchText: `${d.nombre} ${d.descripcion ?? ''} ${d.categoria ?? ''} ${d.subcategoria ?? ''} ${(d.tags ?? []).join(' ')}`,
      }))

      setCatalogo([...fis, ...dig])
    } finally {
      setCargandoCatalogo(false)
    }
  }

  useEffect(() => { cargar(); cargarCatalogo() }, [])

  const agregar = async () => {
    if (!productoSel || !complementarioSel) return
    setError(null)
    setGuardando(true)
    try {
      const res = await fetch('/api/settings-2/bot/complementarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: productoSel.id,
          producto_tipo: productoSel.tipo,
          complementario_id: complementarioSel.id,
          complementario_tipo: complementarioSel.tipo,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al guardar')
      }
      setProductoSel(null)
      setComplementarioSel(null)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    await fetch(`/api/settings-2/bot/complementarios?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h3 className="font-semibold text-zinc-900">Productos complementarios</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Cuando el cliente cotiza el primer producto, el bot puede sugerir el segundo. Funciona con productos físicos y digitales, en cualquier combinación.
        </p>
      </div>

      <div className="p-5 border border-zinc-200 rounded-xl bg-white space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Cuando compran</label>
            <ProductoPicker
              placeholder="Buscar producto..."
              catalogo={catalogo}
              cargandoCatalogo={cargandoCatalogo}
              excluirId={complementarioSel?.id}
              selected={productoSel}
              onSelect={setProductoSel}
            />
          </div>
          <span className="text-zinc-300 text-lg mt-5">→</span>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Sugerir</label>
            <ProductoPicker
              placeholder="Buscar producto..."
              catalogo={catalogo}
              cargandoCatalogo={cargandoCatalogo}
              excluirId={productoSel?.id}
              selected={complementarioSel}
              onSelect={setComplementarioSel}
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          onClick={agregar}
          disabled={!productoSel || !complementarioSel || guardando}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          {guardando ? 'Guardando...' : 'Agregar'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-200 mb-3">
            <Plus className="w-5 h-5 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-600 font-medium">No hay productos configurados</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega pares arriba para que el bot sugiera complementos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-4 border border-zinc-200 rounded-xl bg-white hover:border-indigo-200 transition group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
                <Badge tipo={item.producto.tipo} />
                <span className="text-zinc-900 font-medium truncate">{item.producto.nombre}</span>
                <span className="text-zinc-300">→</span>
                <Badge tipo={item.complementario.tipo} />
                <span className="text-zinc-900 font-medium truncate">{item.complementario.nombre}</span>
              </div>
              <button
                onClick={() => eliminar(item.id)}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition flex-shrink-0"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
