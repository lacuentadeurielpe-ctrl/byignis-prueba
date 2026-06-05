'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  UploadCloud,
  FileText,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  Check,
  X,
  Plus,
  RefreshCw,
  HelpCircle,
  FolderPlus,
  Info
} from 'lucide-react'
import { type Categoria, type Producto } from '@/types/database'
import { formatPEN } from '@/lib/utils'

interface SmartPurchaseCaptureProps {
  onClose: () => void
}

interface ItemExtraccion {
  descripcion_factura: string
  cantidad: number
  unidad_factura: string
  precio_compra_unitario: number
  subtotal: number
  
  accion: 'crear' | 'actualizar'
  producto_existente_id: string | null
  producto_existente_nombre: string | null
  score_match: number
  sugerencias?: Array<{ id: string; nombre: string; score: number }>
  
  // Campos editables por el usuario
  nombre: string // nombre del producto final
  precio_venta_sugerido?: number
  categoria?: string
  stock_minimo?: number
  es_formal: boolean
}

interface CabeceraExtraccion {
  tipo_documento: 'factura' | 'boleta' | 'nota_venta' | 'ticket' | 'desconocido'
  es_formal: boolean
  ruc_proveedor: string | null
  razon_social_proveedor: string | null
  numero_factura: string | null
  fecha_factura: string | null
  total_bruto: number
  igv: number
  total_neto: number
  notas: string
}

export default function SmartPurchaseCapture({ onClose }: SmartPurchaseCaptureProps) {
  const router = useRouter()
  const [step, setStep] = useState<'upload' | 'loading' | 'reconcile'>('upload')
  const [archivos, setArchivos] = useState<{ file: File; preview: string }[]>([])
  const [base64Images, setBase64Images] = useState<{ base64: string; mimeType: string }[]>([])
  const [loadingMsg, setLoadingMsg] = useState('Leyendo comprobante...')
  const [error, setError] = useState<string | null>(null)
  
  // Catálogo y Categorías cargados
  const [catalog, setCatalog] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  // Datos extraídos e interactivos
  const [cabecera, setCabecera] = useState<CabeceraExtraccion>({
    tipo_documento: 'factura',
    es_formal: true,
    ruc_proveedor: '',
    razon_social_proveedor: '',
    numero_factura: '',
    fecha_factura: new Date().toISOString().split('T')[0],
    total_bruto: 0,
    igv: 0,
    total_neto: 0,
    notas: ''
  })
  const [items, setItems] = useState<ItemExtraccion[]>([])
  const [advertencias, setAdvertencias] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Carga inicial del catálogo para re-matching manual
  useEffect(() => {
    async function loadData() {
      try {
        const [resProds, resCats] = await Promise.all([
          fetch('/api/products?activos=true'),
          fetch('/api/categories')
        ])
        if (resProds.ok) setCatalog(await resProds.json())
        if (resCats.ok) setCategorias(await resCats.json())
      } catch (err) {
        console.error('Error cargando catálogo:', err)
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadData()
  }, [])

  // Leer archivos y convertirlos a base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const filesArray = Array.from(e.target.files)
    setError(null)
    
    filesArray.forEach((file) => {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setError('Solo se permiten imágenes (PNG, JPG) o archivos PDF')
        return
      }
      
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1]
        setBase64Images((prev) => [...prev, { base64: base64String, mimeType: file.type }])
        setArchivos((prev) => [
          ...prev,
          { file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '/pdf-icon.png' }
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const quitarArchivo = (index: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index))
    setBase64Images((prev) => prev.filter((_, i) => i !== index))
  }

  // Procesar con IA
  const iniciarProcesamiento = async () => {
    if (base64Images.length === 0) {
      setError('Por favor, selecciona o toma al menos una foto del comprobante')
      return
    }

    setStep('loading')
    setError(null)
    setLoadingMsg('Subiendo imágenes y extrayendo texto con IA...')

    try {
      const timezoneOffset = new Date().getTimezoneOffset()
      const res = await fetch('/api/compras/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagenes: base64Images, timezoneOffset })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al analizar el comprobante')
      }

      const data = await res.json()
      
      // Auto-setear formalidad y facturabilidad de ítems
      const esFormalDoc = ['factura', 'boleta'].includes(data.tipo_documento)
      
      setCabecera({
        tipo_documento: data.tipo_documento || 'factura',
        es_formal: esFormalDoc,
        ruc_proveedor: data.ruc_proveedor || '',
        razon_social_proveedor: data.razon_social_proveedor || '',
        numero_factura: data.numero_factura || '',
        fecha_factura: data.fecha_factura || new Date().toISOString().split('T')[0],
        total_bruto: data.total_bruto || 0,
        igv: data.igv || 0,
        total_neto: data.total_neto || 0,
        notas: ''
      })

      // Preparar ítems para UI
      const itemsMapeados: ItemExtraccion[] = (data.items || []).map((it: any) => ({
        ...it,
        nombre: it.producto_existente_nombre || it.descripcion_factura,
        precio_venta_sugerido: undefined,
        categoria: undefined,
        stock_minimo: undefined,
        es_formal: esFormalDoc // hereda de cabecera por defecto
      }))

      setItems(itemsMapeados)
      setAdvertencias(data.advertencias || [])
      setStep('reconcile')
    } catch (err: any) {
      setError(err.message || 'Error de comunicación con la IA')
      setStep('upload')
    }
  }

  // Manejar cambios en campos de cabecera
  const handleCabeceraChange = (fields: Partial<CabeceraExtraccion>) => {
    setCabecera((prev) => {
      const next = { ...prev, ...fields }
      // Recalcular formalidad si cambia tipo_documento
      if (fields.tipo_documento) {
        next.es_formal = ['factura', 'boleta'].includes(fields.tipo_documento)
        // Auto-actualizar facturable de ítems
        setItems((prevItems) => prevItems.map((item) => ({ ...item, es_formal: next.es_formal })))
      }
      return next
    })
  }

  // Modificar ítem en la lista
  const actualizarItem = (index: number, fields: Partial<ItemExtraccion>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it
        const updated = { ...it, ...fields }
        // Si cambia producto_existente_id, re-matchear nombre del catálogo
        if (fields.producto_existente_id) {
          const prod = catalog.find((p) => p.id === fields.producto_existente_id)
          if (prod) {
            updated.nombre = prod.nombre
            updated.producto_existente_nombre = prod.nombre
            updated.accion = 'actualizar'
            updated.score_match = 100
          }
        } else if (fields.producto_existente_id === null) {
          updated.nombre = it.descripcion_factura
          updated.producto_existente_nombre = null
          updated.accion = 'crear'
          updated.score_match = 0
        }
        
        // Recalcular subtotal
        if (fields.cantidad !== undefined || fields.precio_compra_unitario !== undefined) {
          const c = fields.cantidad ?? it.cantidad
          const p = fields.precio_compra_unitario ?? it.precio_compra_unitario
          updated.subtotal = Number((c * p).toFixed(2))
        }

        return updated
      })
    )
  }

  const eliminarItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const agregarItemManual = () => {
    setItems((prev) => [
      ...prev,
      {
        descripcion_factura: 'Ingresado manualmente',
        cantidad: 1,
        unidad_factura: 'UND',
        precio_compra_unitario: 0,
        subtotal: 0,
        accion: 'crear',
        producto_existente_id: null,
        producto_existente_nombre: null,
        score_match: 0,
        nombre: '',
        es_formal: cabecera.es_formal
      }
    ])
  }

  // Enviar a guardar en DB
  const guardarCompra = async (recibirStock: boolean) => {
    setIsSaving(true)
    setError(null)

    // Validar cabecera obligatoria
    if (cabecera.es_formal) {
      if (!cabecera.numero_factura?.trim()) {
        setError('El número de factura/boleta es obligatorio para compras formales')
        setIsSaving(false)
        return
      }
      if (!cabecera.ruc_proveedor?.trim() || cabecera.ruc_proveedor.length !== 11) {
        setError('El RUC del proveedor debe tener exactamente 11 dígitos')
        setIsSaving(false)
        return
      }
      if (!cabecera.razon_social_proveedor?.trim()) {
        setError('La Razón Social del proveedor es obligatoria')
        setIsSaving(false)
        return
      }
    } else {
      if (!cabecera.razon_social_proveedor?.trim()) {
        setError('Debes ingresar un nombre de proveedor para el registro')
        setIsSaving(false)
        return
      }
    }

    // Validar que no haya nombres vacíos
    for (let i = 0; i < items.length; i++) {
      if (!items[i].nombre.trim()) {
        setError(`El ítem #${i + 1} requiere un nombre de producto válido`)
        setIsSaving(false)
        return
      }
      if (items[i].cantidad <= 0) {
        setError(`La cantidad del ítem "${items[i].nombre}" debe ser mayor a cero`)
        setIsSaving(false)
        return
      }
    }

    try {
      const payload = {
        tipo: cabecera.tipo_documento === 'factura' ? 'formal' : (cabecera.tipo_documento === 'boleta' ? 'formal' : 'informal'),
        numero_factura: cabecera.numero_factura,
        fecha_factura: cabecera.fecha_factura,
        ruc_proveedor: cabecera.ruc_proveedor,
        razon_social_proveedor: cabecera.razon_social_proveedor,
        total_bruto: cabecera.total_bruto,
        igv: cabecera.igv,
        total_neto: cabecera.total_neto,
        notas: cabecera.notas,
        recibir_inmediatamente: recibirStock,
        items: items.map((it) => ({
          descripcion_factura: it.descripcion_factura,
          accion: it.accion,
          producto_existente_id: it.producto_existente_id,
          nombre: it.nombre,
          cantidad: it.cantidad,
          precio_compra_unitario: it.precio_compra_unitario,
          precio_venta_sugerido: it.precio_venta_sugerido,
          unidad: it.unidad_factura,
          categoria: it.categoria,
          stock_minimo: it.stock_minimo,
          es_formal: it.es_formal
        })),
        imagenes: base64Images
      }

      const res = await fetch('/api/compras/ai-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar la compra')
      }

      router.push('/dashboard/contabilidad/compras')
      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error de red al guardar la compra')
    } finally {
      setIsSaving(false)
    }
  }

  // Ignorar / Aprobar masivos
  const aprobarTodosNuevos = () => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.accion === 'crear') {
          return { ...it, es_formal: cabecera.es_formal }
        }
        return it
      })
    )
  }

  // Totales dinámicos calculados a partir de los ítems en pantalla
  const totalNetoCalculado = items.reduce((sum, it) => sum + it.subtotal, 0)
  const totalBrutoCalculado = cabecera.tipo_documento === 'factura' ? totalNetoCalculado / 1.18 : totalNetoCalculado
  const igvCalculado = cabecera.tipo_documento === 'factura' ? totalNetoCalculado - totalBrutoCalculado : 0

  useEffect(() => {
    if (step === 'reconcile') {
      setCabecera((prev) => ({
        ...prev,
        total_neto: Number(totalNetoCalculado.toFixed(2)),
        total_bruto: Number(totalBrutoCalculado.toFixed(2)),
        igv: Number(igvCalculado.toFixed(2))
      }))
    }
  }, [totalNetoCalculado, step])

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xl overflow-hidden transition-all duration-300">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-zinc-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Carga Inteligente de Compras</h2>
            <p className="text-[10px] text-zinc-400">OCR + Extracción Multi-Agente IA y matching de catálogo</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-3.5 flex items-start gap-2.5 text-red-700 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── STEP 1: UPLOAD FILE ── */}
      {step === 'upload' && (
        <div className="p-6 space-y-6">
          {/* Banner informativo de Fase 0 */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3.5 flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Para obtener mejores resultados, asegúrate de que el documento fotografiado contenga visibles los campos de <strong>precio unitario por ítem</strong>, <strong>cantidad</strong> e <strong>importes</strong>. Si es una boleta informal de mercado sin precios, podrás completarlos manualmente en el siguiente paso.
            </p>
          </div>

          {/* Area Drag & Drop */}
          <div className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/20 rounded-2xl p-8 transition flex flex-col items-center justify-center relative cursor-pointer group">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud className="w-10 h-10 text-zinc-400 group-hover:text-zinc-600 transition mb-3" />
            <p className="text-xs font-bold text-zinc-700">Haz clic o arrastra fotos de tu factura aquí</p>
            <p className="text-[10px] text-zinc-400 mt-1">Soporta múltiples páginas (fotos) de un mismo comprobante</p>
          </div>

          {/* Lista de archivos cargados */}
          {archivos.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Imágenes listas para analizar ({archivos.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {archivos.map((arch, index) => (
                  <div key={index} className="relative rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 group shadow-sm flex items-center gap-2">
                    {arch.file.type === 'application/pdf' ? (
                      <div className="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-red-600 font-bold text-[10px]">PDF</div>
                    ) : (
                      <img src={arch.preview} alt="Vista previa" className="w-10 h-10 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-zinc-700 truncate">{arch.file.name}</p>
                      <p className="text-[9px] text-zinc-400">{(arch.file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={() => quitarArchivo(index)}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-red-50 text-red-500 hover:bg-red-100 rounded-full shadow border border-red-200 transition opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-xs font-semibold rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              onClick={iniciarProcesamiento}
              disabled={base64Images.length === 0}
              className="px-5 py-2 bg-zinc-950 hover:bg-zinc-900 disabled:bg-zinc-300 disabled:opacity-70 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow"
            >
              <Sparkles className="w-3.5 h-3.5" /> Analizar con IA
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: LOADING SCREEN ── */}
      {step === 'loading' && (
        <div className="p-12 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-zinc-100 border-t-zinc-900 animate-spin" />
            <Sparkles className="w-5 h-5 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-zinc-800 animate-pulse">{loadingMsg}</p>
            <p className="text-[10px] text-zinc-400">Esto suele tardar entre 5 y 15 segundos dependiendo de la calidad de imagen.</p>
          </div>
        </div>
      )}

      {/* ── STEP 3: RECONCILIATION UI ── */}
      {step === 'reconcile' && (
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-zinc-200/75 max-h-[80vh] overflow-hidden">
          
          {/* LADO IZQUIERDO: CABECERA Y METADATOS COMPROBANTE */}
          <div className="w-full lg:w-80 p-5 overflow-y-auto space-y-4 shrink-0 bg-zinc-50/40">
            <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5 border-b border-zinc-200/50 pb-2">
              <FileText className="w-3.5 h-3.5 text-zinc-500" /> Cabecera de Comprobante
            </h3>

            {/* Tipo Documento */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tipo de Documento</label>
              <select
                value={cabecera.tipo_documento}
                onChange={(e) => handleCabeceraChange({ tipo_documento: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-250 bg-white font-medium text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition"
              >
                <option value="factura">Factura (Formal)</option>
                <option value="boleta">Boleta de Venta (Formal)</option>
                <option value="nota_venta">Nota de Venta (Informal)</option>
                <option value="ticket">Ticket de Caja (Informal)</option>
              </select>
            </div>

            {/* Número comprobante */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Número de Serie-Correlativo</label>
              <input
                value={cabecera.numero_factura || ''}
                onChange={(e) => handleCabeceraChange({ numero_factura: e.target.value })}
                placeholder="F001-00023415"
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-250 focus:outline-none focus:ring-1 focus:ring-zinc-950 font-mono transition"
              />
            </div>

            {/* Fecha Emisión */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Fecha Emisión</label>
              <input
                type="date"
                value={cabecera.fecha_factura || ''}
                onChange={(e) => handleCabeceraChange({ fecha_factura: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-250 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition"
              />
            </div>

            <div className="border-t border-zinc-200/50 pt-3.5 space-y-3">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Proveedor</h4>
              
              {/* RUC */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-1">RUC del Proveedor</label>
                <input
                  value={cabecera.ruc_proveedor || ''}
                  onChange={(e) => handleCabeceraChange({ ruc_proveedor: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  placeholder="11 dígitos"
                  maxLength={11}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-250 focus:outline-none focus:ring-1 focus:ring-zinc-950 font-mono transition"
                />
              </div>

              {/* Razón Social */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Razón Social</label>
                <input
                  value={cabecera.razon_social_proveedor || ''}
                  onChange={(e) => handleCabeceraChange({ razon_social_proveedor: e.target.value })}
                  placeholder="ACEROS AREQUIPA S.A."
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-250 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition"
                />
              </div>
            </div>

            {/* Notas */}
            <div className="border-t border-zinc-200/50 pt-3.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Notas Internas</label>
              <textarea
                value={cabecera.notas}
                onChange={(e) => handleCabeceraChange({ notas: e.target.value })}
                rows={2}
                placeholder="Anotaciones de recepción..."
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-250 focus:outline-none focus:ring-1 focus:ring-zinc-950 resize-none transition"
              />
            </div>

            {/* Totalizadores informativos */}
            <div className="border-t border-zinc-200/50 pt-3.5 space-y-1.5">
              <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                <span>Base (Aprox.):</span>
                <span className="font-mono tabular-nums">{formatPEN(cabecera.total_bruto)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                <span>IGV (18%):</span>
                <span className="font-mono tabular-nums">{formatPEN(cabecera.igv)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-zinc-900 border-t border-zinc-200/50 pt-1.5">
                <span>Total Compra:</span>
                <span className="font-mono text-emerald-600 text-sm tabular-nums">{formatPEN(cabecera.total_neto)}</span>
              </div>
            </div>
          </div>

          {/* LADO DERECHO: ITEMS Y ADVERTENCIAS */}
          <div className="flex-1 flex flex-col min-w-0">
            
            {/* Advertencias / Alertas contables */}
            {advertencias.length > 0 && (
              <div className="bg-amber-50/70 border-b border-amber-100 p-4 space-y-1">
                <p className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Advertencias de Consistencia ({advertencias.length})
                </p>
                <ul className="list-disc pl-4 text-[10px] text-amber-700 font-medium space-y-0.5">
                  {advertencias.map((adv, i) => (
                    <li key={i}>{adv}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Controles de lote y filtros rápidos */}
            <div className="bg-zinc-50 px-5 py-3 border-b border-zinc-150 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Productos a Conciliar ({items.length} ítems)</span>
              <div className="flex gap-2">
                <button
                  onClick={aprobarTodosNuevos}
                  className="px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition"
                >
                  Marcar todos formalidad
                </button>
              </div>
            </div>

            {/* Listado de ítems */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[50vh] min-h-[300px]">
              {items.map((it, idx) => {
                const isNuevo = it.accion === 'crear'
                const score = it.score_match
                
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all duration-200 relative group flex flex-col md:flex-row gap-4 ${
                      isNuevo
                        ? 'border-indigo-100 bg-indigo-50/10'
                        : score < 75
                          ? 'border-amber-100 bg-amber-50/10'
                          : 'border-zinc-150 bg-white'
                    }`}
                  >
                    {/* Botón de borrado de fila */}
                    <button
                      onClick={() => eliminarItem(idx)}
                      className="absolute top-2.5 right-2.5 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex-1 space-y-3 min-w-0">
                      
                      {/* Línea Superior: Descripción de Factura vs Mapeo */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
                          Factura: "{it.descripcion_factura}"
                        </span>
                        
                        {isNuevo ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            🆕 Nuevo en catálogo
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            score >= 85
                              ? 'bg-green-50 text-green-700 border border-green-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            Matched {score}%
                          </span>
                        )}
                      </div>

                      {/* Configuración de Vinculación */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Selector de Producto o Editor de Nombre */}
                        <div className="sm:col-span-8 space-y-1.5">
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Vincular a catálogo</label>
                          <select
                            value={it.producto_existente_id || ''}
                            onChange={(e) => actualizarItem(idx, { producto_existente_id: e.target.value ? e.target.value : null })}
                            className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-950 transition"
                          >
                            <option value="">[ Crear nuevo producto en catálogo ]</option>
                            {catalog.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} {p.codigo_interno ? `[${p.codigo_interno}]` : ''}
                              </option>
                            ))}
                          </select>

                          {/* Sugerencias Rápidas de Matching */}
                          {isNuevo && it.sugerencias && it.sugerencias.length > 0 && (
                            <div className="text-[9px] text-zinc-500 flex flex-wrap gap-1 items-center bg-zinc-50 p-1.5 rounded-lg border border-zinc-150">
                              <span className="font-semibold text-zinc-400">¿Vincular a existente?:</span>
                              {it.sugerencias.map((sug) => (
                                <button
                                  key={sug.id}
                                  type="button"
                                  onClick={() => actualizarItem(idx, { producto_existente_id: sug.id })}
                                  className="px-1.5 py-0.5 bg-white hover:bg-zinc-100 text-zinc-700 rounded border border-zinc-200 transition font-medium"
                                >
                                  {sug.nombre} ({sug.score}%)
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Nombre del Producto Final (Editable) */}
                        <div className="sm:col-span-4">
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Nombre final en catálogo</label>
                          <input
                            value={it.nombre}
                            onChange={(e) => actualizarItem(idx, { nombre: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition"
                          />
                        </div>
                      </div>

                      {/* Campos numéricos y de stock */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                        {/* Cantidad */}
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Cantidad</label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={it.cantidad}
                            onChange={(e) => actualizarItem(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 transition font-bold"
                          />
                        </div>

                        {/* Unidad */}
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Unidad</label>
                          <input
                            value={it.unidad_factura}
                            onChange={(e) => actualizarItem(idx, { unidad_factura: e.target.value.toUpperCase() })}
                            maxLength={3}
                            className="w-full px-2 py-1 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-semibold transition"
                          />
                        </div>

                        {/* Costo Unitario */}
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Costo unit. (S/)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.precio_compra_unitario}
                            onChange={(e) => actualizarItem(idx, { precio_compra_unitario: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-mono text-right transition"
                          />
                        </div>

                        {/* Subtotal */}
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Subtotal (S/)</label>
                          <div className="px-2 py-1.5 rounded-lg border border-zinc-150 bg-zinc-55 text-xs text-right font-bold tabular-nums">
                            {formatPEN(it.subtotal)}
                          </div>
                        </div>

                        {/* Toggle de Facturable */}
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Facturable</label>
                          <label className="flex items-center gap-1.5 cursor-pointer min-h-[30px]">
                            <input
                              type="checkbox"
                              checked={it.es_formal}
                              onChange={(e) => actualizarItem(idx, { es_formal: e.target.checked })}
                              className="rounded border-zinc-350 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="text-[10px] font-medium text-zinc-600">Facturable</span>
                          </label>
                        </div>
                      </div>

                      {/* Campos Especiales para Productos NUEVOS */}
                      {isNuevo && (
                        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Categoría */}
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Categoría sugerida</label>
                            <input
                              list={`categories-list-${idx}`}
                              value={it.categoria || ''}
                              onChange={(e) => actualizarItem(idx, { categoria: e.target.value })}
                              placeholder="Ej: Pinturas, Cemento"
                              className="w-full px-2 py-1 text-xs rounded border border-zinc-250 bg-white focus:outline-none"
                            />
                            <datalist id={`categories-list-${idx}`}>
                              {categorias.map((c) => (
                                <option key={c.id} value={c.nombre} />
                              ))}
                            </datalist>
                          </div>

                          {/* Precio Venta Sugerido */}
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                              Precio de Venta Sugerido S/. (30% marg)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={String(Number((it.precio_compra_unitario * 1.3).toFixed(2)))}
                              value={it.precio_venta_sugerido ?? ''}
                              onChange={(e) => actualizarItem(idx, { precio_venta_sugerido: parseFloat(e.target.value) || undefined })}
                              className="w-full px-2 py-1 text-xs rounded border border-zinc-250 focus:outline-none"
                            />
                          </div>

                          {/* Stock Mínimo */}
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Stock Mínimo Alerta</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="5"
                              value={it.stock_minimo ?? ''}
                              onChange={(e) => actualizarItem(idx, { stock_minimo: parseInt(e.target.value) || undefined })}
                              className="w-full px-2 py-1 text-xs rounded border border-zinc-250 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )
              })}
              
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={agregarItemManual}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl transition border border-zinc-200 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Ítem Manualmente
                </button>
              </div>
            </div>

            {/* Acciones del conciliador */}
            <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-inner">
              <button
                onClick={() => setStep('upload')}
                className="text-xs text-zinc-500 hover:text-zinc-800 font-bold transition flex items-center gap-1.5 justify-center"
              >
                ← Volver a cargar fotos
              </button>
              
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => guardarCompra(false)}
                  disabled={isSaving || items.length === 0}
                  className="px-4 py-2 border border-zinc-250 hover:bg-zinc-100/50 disabled:opacity-50 text-zinc-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar en Borrador
                </button>
                <button
                  onClick={() => guardarCompra(true)}
                  disabled={isSaving || items.length === 0}
                  className="px-5 py-2 bg-zinc-950 hover:bg-zinc-900 disabled:opacity-50 disabled:bg-zinc-750 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar y Recibir Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
