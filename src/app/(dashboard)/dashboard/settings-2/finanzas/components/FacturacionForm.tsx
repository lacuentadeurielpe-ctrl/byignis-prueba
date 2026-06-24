'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Search, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import FormSection from '../../components/FormSection'
import { useSettingsSave } from '../../utils/settingsHooks'

// ── Validaciones SUNAT ────────────────────────────────────────────────────────

/** Algoritmo dígito verificador RUC SUNAT (factores [5,4,3,2,7,6,5,4,3,2]) */
function validarDigitoVerificador(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = factores.reduce((acc, f, i) => acc + f * parseInt(ruc[i]), 0)
  let check = 11 - (suma % 11)
  if (check === 10) check = 0
  if (check === 11) check = 1
  return parseInt(ruc[10]) === check
}

function validarRuc(ruc: string, tipo: 'ruc10' | 'ruc20'): string | null {
  const d = ruc.replace(/\D/g, '')
  if (d.length !== 11) return 'El RUC debe tener exactamente 11 dígitos'
  const prefijo = tipo === 'ruc10' ? '10' : '20'
  if (!d.startsWith(prefijo))
    return `Un RUC de ${tipo === 'ruc10' ? 'Persona Natural' : 'Empresa'} debe empezar con ${prefijo}`
  if (!validarDigitoVerificador(d)) return 'El RUC no es válido (dígito verificador incorrecto)'
  return null
}

function validarSerie(serie: string, tipo: 'boleta' | 'factura'): string | null {
  const letra = tipo === 'boleta' ? 'B' : 'F'
  if (!/^[A-Za-z]\d{3}$/.test(serie))
    return `Debe ser ${letra} seguida de 3 dígitos (ej: ${letra}001)`
  if (serie[0].toUpperCase() !== letra)
    return `Las series de ${tipo}s deben empezar con "${letra}"`
  return null
}

function validarDni(dni: string): string | null {
  if (!dni) return null
  const d = dni.replace(/\D/g, '')
  if (d.length !== 8) return 'El DNI debe tener exactamente 8 dígitos'
  return null
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface FacturacionFormData {
  ruc?: string
  razon_social?: string
  nombre_comercial?: string
  tipo_ruc?: 'sin_ruc' | 'ruc10' | 'ruc20'
  regimen_tributario?: 'rer' | 'rmt' | 'rus' | 'general'
  serie_boletas?: string
  serie_facturas?: string
  igv_incluido_en_precios?: boolean
  representante_legal_nombre?: string
  representante_legal_dni?: string
  representante_legal_cargo?: string
  nubefact_modo?: 'prueba' | 'produccion'
}

interface FieldErrors {
  ruc?: string
  serie_boletas?: string
  serie_facturas?: string
  representante_legal_dni?: string
}

const REGIMENES = [
  {
    id: 'rus',
    label: 'Nuevo RUS',
    descripcion:
      'Para negocios pequeños con ingresos hasta S/ 8,000/mes. No puede emitir facturas.',
  },
  {
    id: 'rer',
    label: 'Régimen Especial (RER)',
    descripcion:
      'Ingresos hasta S/ 525,000/año. Emite boletas y facturas. Cuota del 1.5% sobre ventas netas.',
  },
  {
    id: 'rmt',
    label: 'Régimen MYPE Tributario (RMT)',
    descripcion:
      'Para MYPEs con hasta 1,700 UIT de ingresos. IR del 10% sobre utilidades hasta 15 UIT.',
  },
  {
    id: 'general',
    label: 'Régimen General',
    descripcion:
      'Sin límite de ingresos. IR del 29.5% sobre utilidades. Exige llevar libros contables completos.',
  },
]

// ── Componente ────────────────────────────────────────────────────────────────

export default function FacturacionForm() {
  const { save, isSaving, error: saveError } = useSettingsSave()
  const [data, setData] = useState<FacturacionFormData>({})
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [rucBuscando, setRucBuscando] = useState(false)
  const [rucMensaje, setRucMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(
    null
  )

  useEffect(() => {
    fetch('/api/settings-2/finanzas/facturacion')
      .then(r => (r.ok ? r.json() : {}))
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const handleChange = useCallback(
    (field: keyof FacturacionFormData, value: unknown) => {
      setData(prev => ({ ...prev, [field]: value }))
      setIsDirty(true)
      if (field in fieldErrors) setFieldErrors(prev => ({ ...prev, [field]: undefined }))
    },
    [fieldErrors]
  )

  const handleTipoRucChange = (nuevoTipo: 'sin_ruc' | 'ruc10' | 'ruc20') => {
    setData(prev => ({ ...prev, tipo_ruc: nuevoTipo }))
    setIsDirty(true)
    setRucMensaje(null)
    setFieldErrors(prev => ({ ...prev, ruc: undefined }))
  }

  const handleRucChange = (raw: string) => {
    const soloDigitos = raw.replace(/\D/g, '').slice(0, 11)
    // Auto-detectar tipo según los primeros 2 dígitos
    if (soloDigitos.length >= 2) {
      const prefijo = soloDigitos.slice(0, 2)
      if (prefijo === '10' && data.tipo_ruc !== 'ruc10') {
        setData(prev => ({ ...prev, ruc: soloDigitos, tipo_ruc: 'ruc10' }))
        setIsDirty(true)
        setRucMensaje(null)
        return
      }
      if (prefijo === '20' && data.tipo_ruc !== 'ruc20') {
        setData(prev => ({ ...prev, ruc: soloDigitos, tipo_ruc: 'ruc20' }))
        setIsDirty(true)
        setRucMensaje(null)
        return
      }
    }
    handleChange('ruc', soloDigitos)
    setRucMensaje(null)
  }

  const buscarEnSunat = useCallback(async () => {
    const ruc = (data.ruc || '').replace(/\D/g, '')
    if (ruc.length !== 11) return
    setRucBuscando(true)
    setRucMensaje(null)
    try {
      const res = await fetch('/api/sunat/ruc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruc }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRucMensaje({ tipo: 'error', texto: json.error ?? 'No se pudo consultar SUNAT' })
      } else {
        setData(prev => ({
          ...prev,
          razon_social: json.razonSocial || prev.razon_social,
          tipo_ruc: (json.tipoRucSugerido as 'ruc10' | 'ruc20') ?? prev.tipo_ruc,
        }))
        setIsDirty(true)
        const estado = json.activo ? 'Activo y Habido' : 'No activo o no habido'
        setRucMensaje({
          tipo: json.activo ? 'ok' : 'error',
          texto: `${json.razonSocial} — ${estado}`,
        })
      }
    } catch {
      setRucMensaje({ tipo: 'error', texto: 'Error de conexión al consultar SUNAT' })
    } finally {
      setRucBuscando(false)
    }
  }, [data.ruc])

  // Auto-buscar cuando el RUC llega a 11 dígitos
  useEffect(() => {
    const ruc = (data.ruc || '').replace(/\D/g, '')
    if (ruc.length === 11 && data.tipo_ruc && data.tipo_ruc !== 'sin_ruc') {
      buscarEnSunat()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.ruc])

  const handleSave = async () => {
    const errors: FieldErrors = {}

    if (data.tipo_ruc && data.tipo_ruc !== 'sin_ruc' && data.ruc) {
      const err = validarRuc(data.ruc, data.tipo_ruc)
      if (err) errors.ruc = err
    }
    if (data.serie_boletas) {
      const err = validarSerie(data.serie_boletas, 'boleta')
      if (err) errors.serie_boletas = err
    }
    if (data.serie_facturas) {
      const err = validarSerie(data.serie_facturas, 'factura')
      if (err) errors.serie_facturas = err
    }
    if (data.representante_legal_dni) {
      const err = validarDni(data.representante_legal_dni)
      if (err) errors.representante_legal_dni = err
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const payload = {
      ...data,
      serie_boletas: data.serie_boletas?.toUpperCase(),
      serie_facturas: data.serie_facturas?.toUpperCase(),
      ruc: data.ruc?.replace(/\D/g, '') || null,
    }

    await save(payload, '/api/settings-2/finanzas/facturacion')
    setIsDirty(false)
  }

  if (loading) return <div className="text-sm text-zinc-500 py-4">Cargando...</div>

  const tipoRuc = data.tipo_ruc ?? 'sin_ruc'
  const rucDigitos = (data.ruc || '').replace(/\D/g, '')
  const rucCompleto = rucDigitos.length === 11

  return (
    <FormSection
      title="Configuración Tributaria"
      description="Datos fiscales para emisión de comprobantes electrónicos (SUNAT)"
      icon={<FileText className="w-5 h-5" />}
      onSave={handleSave}
      onCancel={() => {
        setIsDirty(false)
        setFieldErrors({})
      }}
      isSaving={isSaving}
      isDirty={isDirty}
    >
      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {saveError}
        </div>
      )}

      <div className="space-y-6">
        {/* ── Tipo de contribuyente ──────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Tipo de contribuyente
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                {
                  value: 'sin_ruc',
                  label: 'Sin RUC',
                  sub: 'Negocio informal / solo notas de venta',
                },
                {
                  value: 'ruc10',
                  label: 'Persona Natural',
                  sub: 'Emprendedor individual — RUC empieza con 10',
                },
                {
                  value: 'ruc20',
                  label: 'Empresa',
                  sub: 'Persona Jurídica (SAC, EIRL, SRL...) — RUC empieza con 20',
                },
              ] as const
            ).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleTipoRucChange(opt.value)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                  tipoRuc === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                    : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5 leading-tight">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── RUC + verificación SUNAT ──────────────────────── */}
        {tipoRuc !== 'sin_ruc' && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              RUC
              <span className="text-zinc-400 font-normal ml-1">
                — siempre 11 dígitos, empieza con {tipoRuc === 'ruc10' ? '10' : '20'}
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={data.ruc || ''}
                onChange={e => handleRucChange(e.target.value)}
                maxLength={11}
                className={`flex-1 px-3 py-2 border rounded-lg text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.ruc ? 'border-rose-300 bg-rose-50' : 'border-zinc-200'
                }`}
                placeholder={tipoRuc === 'ruc10' ? '10XXXXXXXXX' : '20XXXXXXXXX'}
              />
              <button
                type="button"
                onClick={buscarEnSunat}
                disabled={!rucCompleto || rucBuscando}
                className="px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap bg-white"
              >
                {rucBuscando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                Verificar SUNAT
              </button>
            </div>

            {fieldErrors.ruc && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.ruc}
              </p>
            )}
            {rucMensaje && !fieldErrors.ruc && (
              <p
                className={`text-xs mt-1.5 flex items-center gap-1 ${
                  rucMensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {rucMensaje.tipo === 'ok' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                {rucMensaje.texto}
              </p>
            )}
          </div>
        )}

        {/* ── Razón Social + Nombre Comercial ───────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Razón Social
            </label>
            <input
              type="text"
              value={data.razon_social || ''}
              onChange={e => handleChange('razon_social', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nombre legal según SUNAT"
            />
            <p className="text-xs text-zinc-400 mt-1">
              Se auto-completa al verificar el RUC
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Nombre Comercial
            </label>
            <input
              type="text"
              value={data.nombre_comercial || ''}
              onChange={e => handleChange('nombre_comercial', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Marca o nombre de la tienda"
            />
          </div>
        </div>

        {/* ── Régimen Tributario ─────────────────────────────── */}
        {tipoRuc !== 'sin_ruc' && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Régimen Tributario
            </label>
            <div className="space-y-2">
              {REGIMENES.map(r => (
                <label
                  key={r.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    data.regimen_tributario === r.id
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="regimen_tributario"
                    value={r.id}
                    checked={data.regimen_tributario === r.id}
                    onChange={() => handleChange('regimen_tributario', r.id)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-800">{r.label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 leading-snug">{r.descripcion}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Series de comprobantes ─────────────────────────── */}
        {tipoRuc !== 'sin_ruc' && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Series de comprobantes
            </label>
            <p className="text-xs text-zinc-500 mb-3 flex items-start gap-1">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Una letra seguida de 3 dígitos (ej: B001, F001). Debe coincidir con la serie
              registrada en tu cuenta Nubefact.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">Serie Boletas</label>
                <input
                  type="text"
                  value={data.serie_boletas || ''}
                  onChange={e =>
                    handleChange('serie_boletas', e.target.value.toUpperCase().slice(0, 4))
                  }
                  maxLength={4}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.serie_boletas ? 'border-rose-300 bg-rose-50' : 'border-zinc-200'
                  }`}
                  placeholder="B001"
                />
                {fieldErrors.serie_boletas && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.serie_boletas}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">Serie Facturas</label>
                <input
                  type="text"
                  value={data.serie_facturas || ''}
                  onChange={e =>
                    handleChange('serie_facturas', e.target.value.toUpperCase().slice(0, 4))
                  }
                  maxLength={4}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.serie_facturas ? 'border-rose-300 bg-rose-50' : 'border-zinc-200'
                  }`}
                  placeholder="F001"
                />
                {fieldErrors.serie_facturas && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.serie_facturas}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── IGV ───────────────────────────────────────────── */}
        <div className="border-t border-zinc-100 pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.igv_incluido_en_precios ?? false}
              onChange={e => handleChange('igv_incluido_en_precios', e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-zinc-300 accent-indigo-600"
            />
            <div>
              <span className="text-sm font-medium text-zinc-700">
                Los precios de mi catálogo ya incluyen IGV (18%)
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">
                Si está desactivado, el sistema agrega el 18% al precio de lista al emitir un
                comprobante. Activa esto si tus precios ya son precio final con IGV incluido.
              </p>
            </div>
          </label>
        </div>

        {/* ── Representante Legal (solo Persona Jurídica) ───── */}
        {tipoRuc === 'ruc20' && (
          <div>
            <h4 className="text-sm font-medium text-zinc-700 mb-1">Representante Legal</h4>
            <p className="text-xs text-zinc-500 mb-3">
              Requerido para la emisión de facturas electrónicas por SUNAT.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  value={data.representante_legal_nombre || ''}
                  onChange={e => handleChange('representante_legal_nombre', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Apellidos y nombres según DNI"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-600 mb-1.5">DNI</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={data.representante_legal_dni || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                      handleChange('representante_legal_dni', v)
                    }}
                    maxLength={8}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      fieldErrors.representante_legal_dni
                        ? 'border-rose-300 bg-rose-50'
                        : 'border-zinc-200'
                    }`}
                    placeholder="12345678"
                  />
                  {fieldErrors.representante_legal_dni && (
                    <p className="text-xs text-rose-600 mt-1">
                      {fieldErrors.representante_legal_dni}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1.5">Cargo</label>
                  <input
                    type="text"
                    value={data.representante_legal_cargo || ''}
                    onChange={e => handleChange('representante_legal_cargo', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Gerente General"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Modo Nubefact ──────────────────────────────────── */}
        <div className="border-t border-zinc-100 pt-4">
          <label className="block text-sm font-medium text-zinc-700 mb-2">Modo Nubefact</label>
          <div className="flex gap-3">
            {(
              [
                { value: 'prueba', label: 'Sandbox (pruebas)', colorClass: 'amber' },
                { value: 'produccion', label: 'Producción', colorClass: 'emerald' },
              ] as const
            ).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleChange('nubefact_modo', opt.value)}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                  (data.nubefact_modo ?? 'prueba') === opt.value
                    ? opt.colorClass === 'amber'
                      ? 'border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 bg-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2 flex items-start gap-1">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Cambia a Producción solo después de verificar que los comprobantes se emiten
            correctamente en modo sandbox.
          </p>
        </div>
      </div>
    </FormSection>
  )
}
