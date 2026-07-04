'use client'

import { useState, useEffect } from 'react'
import { Palette } from 'lucide-react'
import FormSection from '../../components/FormSection'
import { useSettingsSave } from '../../utils/settingsHooks'
import ImageUploader from '@/components/ui/ImageUploader'
import { cn } from '@/lib/utils'

interface AparienciaFormData {
  logo_url?: string
  color_comprobante?: string
  pdf_color_secundario?: string
  pdf_formato_boleta?: string
  pdf_formato_factura?: string
  pdf_formato_nota_venta?: string
}

export default function ComprobanteAparienciaForm() {
  const { save, isSaving, error } = useSettingsSave()
  const [data, setData] = useState<AparienciaFormData>({})
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/negocio/general')
        if (res.ok) {
          const result = await res.json()
          setData({
            logo_url: result.logo_url || '',
            color_comprobante: result.color_comprobante || '#1e40af',
            pdf_color_secundario: result.pdf_color_secundario || '#e67e22',
            pdf_formato_boleta: result.pdf_formato_boleta || 'clasico',
            pdf_formato_factura: result.pdf_formato_factura || 'clasico',
            pdf_formato_nota_venta: result.pdf_formato_nota_venta || 'ticket',
          })
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleChange = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    await save(data, '/api/settings-2/negocio/general')
    setIsDirty(false)
  }

  const colorOptions = [
    { label: 'Azul', hex: '#1e40af' },
    { label: 'Rojo', hex: '#b91c1c' },
    { label: 'Verde', hex: '#15803d' },
    { label: 'Naranja', hex: '#c2410c' },
    { label: 'Negro', hex: '#171717' },
    { label: 'Morado', hex: '#6d28d9' }
  ]

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <FormSection
      title="Apariencia de Comprobantes"
      description="Personaliza logo, colores y formato de tus PDFs (Boletas, Facturas, Notas de Venta)."
      icon={<Palette className="w-5 h-5" />}
      onSave={handleSave}
      onCancel={() => setIsDirty(false)}
      isSaving={isSaving}
      isDirty={isDirty}
    >
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-8">
        
        {/* LOGO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-zinc-200 pb-6">
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-zinc-900">🖼️ Logo del Negocio</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Este logo aparecerá en la parte superior de tus boletas, facturas y proformas.
            </p>
          </div>
          <div className="col-span-1 md:col-span-2">
            <ImageUploader 
              value={data.logo_url || ''} 
              onChange={val => handleChange('logo_url', val)} 
              bucket="logos"
              pathPrefix="ferreteria"
            />
          </div>
        </div>

        {/* COLORES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-zinc-200 pb-6">
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-zinc-900">🎨 Colores Institucionales</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Mantén tu identidad de marca. SUNAT permite colores mientras sea legible.
            </p>
          </div>
          <div className="col-span-1 md:col-span-2 space-y-5">
            <div className="max-w-md">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Color Principal (Bandas, títulos)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {colorOptions.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => handleChange('color_comprobante', c.hex)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      data.color_comprobante === c.hex ? "border-zinc-900 scale-110 shadow-sm" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={data.color_comprobante || '#1e40af'}
                  onChange={e => handleChange('color_comprobante', e.target.value)}
                  className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent"
                />
                <input 
                  type="text"
                  value={data.color_comprobante || '#1e40af'}
                  onChange={e => handleChange('color_comprobante', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="max-w-md">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Color Secundario (Acentos, líneas)</label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={data.pdf_color_secundario || '#e67e22'}
                  onChange={e => handleChange('pdf_color_secundario', e.target.value)}
                  className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent"
                />
                <input 
                  type="text"
                  value={data.pdf_color_secundario || '#e67e22'}
                  onChange={e => handleChange('pdf_color_secundario', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FORMATOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-zinc-900">📄 Formatos de Documento</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Elige cómo se imprimen o exportan tus comprobantes por tipo.
            </p>
          </div>
          <div className="col-span-1 md:col-span-2 space-y-5 max-w-md">
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Boletas</label>
              <select
                value={data.pdf_formato_boleta || 'clasico'}
                onChange={e => handleChange('pdf_formato_boleta', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="clasico">A4 Clásico (Tradicional sin banda)</option>
                <option value="moderno">A4 Moderno (Con banda de color sup.)</option>
                <option value="compacto">A5 Compacto (Mitad de hoja)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Facturas</label>
              <select
                value={data.pdf_formato_factura || 'clasico'}
                onChange={e => handleChange('pdf_formato_factura', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="clasico">A4 Clásico (Formal SUNAT)</option>
                <option value="moderno">A4 Moderno (Branded color)</option>
                <option value="compacto">A5 Compacto (Mitad de hoja)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Notas de Venta / Proformas</label>
              <select
                value={data.pdf_formato_nota_venta || 'ticket'}
                onChange={e => handleChange('pdf_formato_nota_venta', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="ticket">Ticket 80mm (Impresora térmica standard)</option>
                <option value="compacto">Ticket 58mm (Impresora pequeña)</option>
                <option value="a5">A5 Diseño Moderno (Hoja)</option>
              </select>
            </div>

          </div>
        </div>

      </div>
    </FormSection>
  )
}
