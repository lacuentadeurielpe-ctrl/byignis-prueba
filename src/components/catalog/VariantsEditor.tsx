'use client'

import { useState } from 'react'
import { Plus, Trash2, Sparkles, Image as ImageIcon, Check, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AtributoValorForm {
  id?: string
  valor: string
  color_hex?: string
}

export interface ProductoAtributoForm {
  id?: string
  nombre: string
  valores: AtributoValorForm[]
}

export interface VarianteForm {
  id?: string
  nombre_variante: string
  sku?: string
  precio?: string
  precio_compra?: string
  stock: string
  stock_minimo?: string
  imagen_url?: string
  activo: boolean
  venta_sin_stock: boolean
  valores_ids: string[]
}

interface VariantsEditorProps {
  tieneVariantes: boolean
  onToggleTieneVariantes: (val: boolean) => void
  atributos: ProductoAtributoForm[]
  onAtributosChange: (atributos: ProductoAtributoForm[]) => void
  variantes: VarianteForm[]
  onVariantesChange: (variantes: VarianteForm[]) => void
  precioBase: number
}

export default function VariantsEditor({
  tieneVariantes,
  onToggleTieneVariantes,
  atributos,
  onAtributosChange,
  variantes,
  onVariantesChange,
  precioBase,
}: VariantsEditorProps) {
  const [nuevoAtributoNombre, setNuevoAtributoNombre] = useState('')
  const [nuevoValorTexto, setNuevoValorTexto] = useState<Record<number, string>>({})
  const [nuevoValorColorHex, setNuevoValorColorHex] = useState<Record<number, string>>({})

  // Agregar un nuevo tipo de atributo (ej. "Color", "Talla")
  const agregarAtributo = () => {
    if (!nuevoAtributoNombre.trim()) return
    const nuevo: ProductoAtributoForm = {
      nombre: nuevoAtributoNombre.trim(),
      valores: [],
    }
    onAtributosChange([...atributos, nuevo])
    setNuevoAtributoNombre('')
  }

  // Eliminar un atributo
  const eliminarAtributo = (idx: number) => {
    const nuevos = atributos.filter((_, i) => i !== idx)
    onAtributosChange(nuevos)
  }

  // Agregar valor a un atributo específico
  const agregarValor = (attrIdx: number) => {
    const valText = nuevoValorTexto[attrIdx]?.trim()
    if (!valText) return

    const colorHex = nuevoValorColorHex[attrIdx] || undefined
    const attr = atributos[attrIdx]
    const valorNuevo: AtributoValorForm = { valor: valText, color_hex: colorHex }

    const atributosNuevos = [...atributos]
    atributosNuevos[attrIdx] = {
      ...attr,
      valores: [...attr.valores, valorNuevo],
    }

    onAtributosChange(atributosNuevos)
    setNuevoValorTexto((prev) => ({ ...prev, [attrIdx]: '' }))
    setNuevoValorColorHex((prev) => ({ ...prev, [attrIdx]: '' }))
  }

  // Eliminar valor de atributo
  const eliminarValor = (attrIdx: number, valIdx: number) => {
    const attr = atributos[attrIdx]
    const atributosNuevos = [...atributos]
    atributosNuevos[attrIdx] = {
      ...attr,
      valores: attr.valores.filter((_, i) => i !== valIdx),
    }
    onAtributosChange(atributosNuevos)
  }

  // Generar Producto Cartesiano de Variantes
  const generarCombinaciones = () => {
    if (atributos.length === 0 || atributos.some((a) => a.valores.length === 0)) return

    // Generador cartesiano recursivo
    const cartesian = (args: AtributoValorForm[][]): AtributoValorForm[][] => {
      const r: AtributoValorForm[][] = []
      const max = args.length - 1
      function helper(arr: AtributoValorForm[], i: number) {
        for (let j = 0, l = args[i].length; j < l; j++) {
          const a = [...arr, args[i][j]]
          if (i === max) r.push(a)
          else helper(a, i + 1)
        }
      }
      helper([], 0)
      return r
    }

    const combinaciones = cartesian(atributos.map((a) => a.valores))

    const variantesNuevas: VarianteForm[] = combinaciones.map((comb) => {
      const nombreVar = comb.map((c) => c.valor).join(' / ')
      const idsValores = comb.map((c) => c.id || c.valor) // fallback a valor si no tiene id aún

      // Preservar valores existentes si ya había una variante con el mismo nombre
      const existente = variantes.find((v) => v.nombre_variante === nombreVar)
      if (existente) return existente

      return {
        nombre_variante: nombreVar,
        sku: '',
        precio: '', // vacío = hereda precio base
        stock: '0',
        stock_minimo: '0',
        activo: true,
        venta_sin_stock: false,
        valores_ids: idsValores,
      }
    })

    onVariantesChange(variantesNuevas)
  }

  // Editar campo de una variante específica
  const actualizarVarianteField = (idx: number, field: keyof VarianteForm, value: any) => {
    const nuevas = [...variantes]
    nuevas[idx] = { ...nuevas[idx], [field]: value }
    onVariantesChange(nuevas)
  }

  // Eliminar variante individual
  const eliminarVariante = (idx: number) => {
    onVariantesChange(variantes.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6">
      {/* Switch principal para activar variantes */}
      <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">¿Este producto tiene opciones/variantes?</h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Actívalo para definir atributos como Talla, Color o Material con su propio stock y precio.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={tieneVariantes}
            onChange={(e) => onToggleTieneVariantes(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
        </label>
      </div>

      {tieneVariantes && (
        <>
          {/* SECCIÓN 1: Definir Atributos */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <span>1. Atributos de producto</span>
              <span className="text-xs font-normal text-zinc-400">(Ej. Color, Talla, Material)</span>
            </h4>

            {/* Lista de atributos definidos */}
            <div className="space-y-4">
              {atributos.map((attr, attrIdx) => (
                <div key={attrIdx} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-900">{attr.nombre}</span>
                    <button
                      type="button"
                      onClick={() => eliminarAtributo(attrIdx)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar atributo
                    </button>
                  </div>

                  {/* Chips de valores */}
                  <div className="flex flex-wrap gap-2">
                    {attr.valores.map((v, vIdx) => (
                      <span
                        key={vIdx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 shadow-sm"
                      >
                        {v.color_hex && (
                          <span
                            className="w-3 h-3 rounded-full border border-zinc-300"
                            style={{ backgroundColor: v.color_hex }}
                          />
                        )}
                        {v.valor}
                        <button
                          type="button"
                          onClick={() => eliminarValor(attrIdx, vIdx)}
                          className="text-zinc-400 hover:text-red-500 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Input para agregar nuevo valor */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder={`Opción para ${attr.nombre} (ej: Rojo, M)`}
                      value={nuevoValorTexto[attrIdx] || ''}
                      onChange={(e) => setNuevoValorTexto({ ...nuevoValorTexto, [attrIdx]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          agregarValor(attrIdx)
                        }
                      }}
                      className="px-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 flex-1"
                    />
                    <div className="flex items-center gap-2">
                      {attr.nombre.toLowerCase().includes('color') && (
                        <div className="flex items-center gap-1">
                          <Palette className="w-3.5 h-3.5 text-zinc-400" />
                          <input
                            type="color"
                            value={nuevoValorColorHex[attrIdx] || '#000000'}
                            onChange={(e) => setNuevoValorColorHex({ ...nuevoValorColorHex, [attrIdx]: e.target.value })}
                            className="w-7 h-7 p-0 border border-zinc-200 rounded cursor-pointer"
                            title="Elegir color visual"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => agregarValor(attrIdx)}
                        className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg transition text-center"
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input agregar nuevo atributo */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-zinc-100">
              <input
                type="text"
                placeholder="Nombre del atributo (ej: Talla, Color)"
                value={nuevoAtributoNombre}
                onChange={(e) => setNuevoAtributoNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarAtributo()
                  }
                }}
                className="px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-400 flex-1"
              />
              <button
                type="button"
                onClick={agregarAtributo}
                className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear Atributo
              </button>
            </div>
          </div>

          {/* SECCIÓN 2: Generar y Administrar Variantes */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900">2. Variantes generadas</h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Cada variante tiene su propio stock, SKU y precio personalizado.
                </p>
              </div>
              <button
                type="button"
                onClick={generarCombinaciones}
                disabled={atributos.length === 0 || atributos.some((a) => a.valores.length === 0)}
                className="px-4 py-2 text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generar combinaciones ({atributos.reduce((acc, a) => acc * Math.max(1, a.valores.length), 1)})
              </button>
            </div>

            {variantes.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-zinc-100 rounded-xl">
                <p className="text-xs text-zinc-400">
                  Agrega atributos arriba y haz clic en &ldquo;Generar combinaciones&rdquo; para listar las variantes.
                </p>
              </div>
            ) : (
              <>
                {/* Vista móvil: tarjetas */}
                <div className="sm:hidden space-y-3">
                  {variantes.map((v, idx) => (
                    <div key={idx} className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-900 flex-1 min-w-0 truncate">{v.nombre_variante}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => actualizarVarianteField(idx, 'activo', !v.activo)}
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold transition',
                              v.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'
                            )}
                          >
                            {v.activo ? 'Activo' : 'Inactivo'}
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarVariante(idx)}
                            className="text-zinc-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="SKU / Código"
                        value={v.sku || ''}
                        onChange={(e) => actualizarVarianteField(idx, 'sku', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">Precio (S/)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={`Base: ${precioBase.toFixed(2)}`}
                            value={v.precio || ''}
                            onChange={(e) => actualizarVarianteField(idx, 'precio', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">Stock</label>
                          <input
                            type="number"
                            value={v.stock || '0'}
                            onChange={(e) => actualizarVarianteField(idx, 'stock', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista desktop: tabla */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-zinc-500 font-semibold">
                        <th className="p-2.5">Variante</th>
                        <th className="p-2.5">SKU / Código</th>
                        <th className="p-2.5 text-right">Precio (S/)</th>
                        <th className="p-2.5 text-right">Stock</th>
                        <th className="p-2.5 text-center">Estado</th>
                        <th className="p-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {variantes.map((v, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="p-2.5 font-medium text-zinc-900">{v.nombre_variante}</td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              placeholder="SKU libre"
                              value={v.sku || ''}
                              onChange={(e) => actualizarVarianteField(idx, 'sku', e.target.value)}
                              className="w-28 px-2 py-1 border border-zinc-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              placeholder={`Base: ${precioBase.toFixed(2)}`}
                              value={v.precio || ''}
                              onChange={(e) => actualizarVarianteField(idx, 'precio', e.target.value)}
                              className="w-24 px-2 py-1 border border-zinc-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              value={v.stock || '0'}
                              onChange={(e) => actualizarVarianteField(idx, 'stock', e.target.value)}
                              className="w-20 px-2 py-1 border border-zinc-200 rounded text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => actualizarVarianteField(idx, 'activo', !v.activo)}
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold transition',
                                v.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'
                              )}
                            >
                              {v.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => eliminarVariante(idx)}
                              className="text-zinc-400 hover:text-red-500 p-1"
                              title="Eliminar esta variante"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
