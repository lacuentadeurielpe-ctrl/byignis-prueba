'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@headlessui/react'
import { Save, Loader2, Globe, Copy, Check } from 'lucide-react'

export default function CatalogoPublicoForm() {
  const [slug, setSlug] = useState('')
  const [config, setConfig] = useState({
    mostrar_precios: true,
    mostrar_sin_stock: false,
    mostrar_descripciones: true,
    mostrar_imagenes: true,
    mostrar_bulk_pricing: true,
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const publicUrl = slug ? `${origin}/tienda/${slug}` : ''

  useEffect(() => {
    fetch('/api/settings-2/negocio/general')
      .then(res => res.json())
      .then(data => {
        setSlug(data.catalogo_slug || '')
        if (data.catalogo_config) {
          setConfig({
            mostrar_precios: data.catalogo_config.mostrar_precios ?? true,
            mostrar_sin_stock: data.catalogo_config.mostrar_sin_stock ?? false,
            mostrar_descripciones: data.catalogo_config.mostrar_descripciones ?? true,
            mostrar_imagenes: data.catalogo_config.mostrar_imagenes ?? true,
            mostrar_bulk_pricing: data.catalogo_config.mostrar_bulk_pricing ?? true,
          })
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const handleCopy = () => {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      setError('El enlace solo puede contener letras minúsculas, números y guiones')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/settings-2/negocio/general', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogo_slug: slug.trim() || null,
          catalogo_config: config,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        if (d.error?.includes('unique') || d.error?.includes('llave duplicada')) {
          throw new Error('Ese enlace ya está siendo usado por otro negocio')
        }
        throw new Error(d.error || 'Error al guardar')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Globe className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Catálogo Digital (Público)</h2>
          <p className="text-sm text-gray-500">Configura tu tienda en línea para tus clientes</p>
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Enlace Público de tu Tienda</label>
          <div className="flex rounded-lg shadow-sm">
            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
              {origin}/tienda/
            </span>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="mi-negocio"
              className="flex-1 block w-full min-w-0 rounded-none rounded-r-lg border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Usa minúsculas y guiones (ej. mi-tienda-genial)</p>
        </div>

        {slug && (
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100 mt-2">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 hover:underline font-medium break-all">
              {publicUrl}
            </a>
            <button
              onClick={handleCopy}
              className="ml-3 flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-700 text-xs font-medium rounded-md border border-emerald-200 hover:bg-emerald-50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        )}

        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Configuración de Visualización</h3>
          
          <div className="space-y-4">
            <Switch.Group as="div" className="flex items-center justify-between">
              <span className="flex flex-col">
                <Switch.Label as="span" className="text-sm font-medium text-gray-900" passive>
                  Mostrar Precios
                </Switch.Label>
                <Switch.Description as="span" className="text-xs text-gray-500">
                  Si se apaga, funciona como un portafolio sin precios
                </Switch.Description>
              </span>
              <Switch
                checked={config.mostrar_precios}
                onChange={v => setConfig(prev => ({ ...prev, mostrar_precios: v }))}
                className={`${
                  config.mostrar_precios ? 'bg-emerald-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
              >
                <span className={`${config.mostrar_precios ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
              </Switch>
            </Switch.Group>

            <Switch.Group as="div" className="flex items-center justify-between">
              <span className="flex flex-col">
                <Switch.Label as="span" className="text-sm font-medium text-gray-900" passive>
                  Mostrar Productos sin Stock
                </Switch.Label>
                <Switch.Description as="span" className="text-xs text-gray-500">
                  Si se apaga, los productos agotados desaparecen del catálogo
                </Switch.Description>
              </span>
              <Switch
                checked={config.mostrar_sin_stock}
                onChange={v => setConfig(prev => ({ ...prev, mostrar_sin_stock: v }))}
                className={`${
                  config.mostrar_sin_stock ? 'bg-emerald-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
              >
                <span className={`${config.mostrar_sin_stock ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
              </Switch>
            </Switch.Group>

            <Switch.Group as="div" className="flex items-center justify-between">
              <span className="flex flex-col">
                <Switch.Label as="span" className="text-sm font-medium text-gray-900" passive>
                  Mostrar Precios por Mayor
                </Switch.Label>
                <Switch.Description as="span" className="text-xs text-gray-500">
                  Muestra la tabla de descuentos por volumen
                </Switch.Description>
              </span>
              <Switch
                checked={config.mostrar_bulk_pricing}
                onChange={v => setConfig(prev => ({ ...prev, mostrar_bulk_pricing: v }))}
                className={`${
                  config.mostrar_bulk_pricing ? 'bg-emerald-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
              >
                <span className={`${config.mostrar_bulk_pricing ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
              </Switch>
            </Switch.Group>

            <Switch.Group as="div" className="flex items-center justify-between">
              <span className="flex flex-col">
                <Switch.Label as="span" className="text-sm font-medium text-gray-900" passive>
                  Mostrar Imágenes
                </Switch.Label>
                <Switch.Description as="span" className="text-xs text-gray-500">
                  Si se apaga, el catálogo será solo en formato lista
                </Switch.Description>
              </span>
              <Switch
                checked={config.mostrar_imagenes}
                onChange={v => setConfig(prev => ({ ...prev, mostrar_imagenes: v }))}
                className={`${
                  config.mostrar_imagenes ? 'bg-emerald-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
              >
                <span className={`${config.mostrar_imagenes ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
              </Switch>
            </Switch.Group>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex items-center justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : success ? 'Guardado' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  )
}
