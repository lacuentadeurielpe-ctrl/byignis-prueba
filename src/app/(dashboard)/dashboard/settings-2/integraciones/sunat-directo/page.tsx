'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, AlertCircle, CheckCircle, Loader2, Eye, EyeOff, Upload, Info, ExternalLink } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import FormSection from '../../components/FormSection'

interface EstadoSunat {
  configurado:     boolean
  proveedor_activo: string
  credenciales?: {
    id:                            string
    ruc:                           string
    razon_social:                  string
    modo:                          'beta' | 'produccion'
    estado:                        'pendiente' | 'homologando' | 'activo' | 'error'
    greenter_url:                  string
    ultimo_test_at?:               string
    ultimo_error?:                 string
    homologacion_casos_completados: number
    homologacion_completada_at?:   string
  }
}

export default function SunatDirectoPage() {
  const [estado, setEstado] = useState<EstadoSunat | null>(null)
  const [loading, setLoading] = useState(true)

  // Formulario
  const [ruc, setRuc] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [solUsuario, setSolUsuario] = useState('')
  const [solClave, setSolClave] = useState('')
  const [certPfxB64, setCertPfxB64] = useState('')
  const [certNombre, setCertNombre] = useState('')
  const [certClave, setCertClave] = useState('')
  const [modo, setModo] = useState<'beta' | 'produccion'>('beta')
  const [greenterUrl, setGreenterUrl] = useState('')

  const [showSolClave, setShowSolClave] = useState(false)
  const [showCertClave, setShowCertClave] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings-2/integraciones/sunat-directo')
      .then(r => r.json())
      .then(d => {
        setEstado(d)
        if (d.credenciales) {
          setRuc(d.credenciales.ruc)
          setRazonSocial(d.credenciales.razon_social)
          setModo(d.credenciales.modo)
          setGreenterUrl(d.credenciales.greenter_url)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      setError('El certificado debe ser un archivo .pfx o .p12')
      return
    }
    setCertNombre(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const ab = ev.target?.result as ArrayBuffer
      const bytes = new Uint8Array(ab)
      let b64 = ''
      for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
      setCertPfxB64(btoa(b64))
    }
    reader.readAsArrayBuffer(file)
  }

  const handleGuardar = async () => {
    setError('')
    setSuccess('')
    if (!ruc || !razonSocial || !solUsuario || !solClave || !certClave) {
      setError('Completa todos los campos requeridos')
      return
    }
    if (!certPfxB64 && !estado?.credenciales) {
      setError('Debes subir el certificado digital (.pfx/.p12)')
      return
    }
    setIsSaving(true)
    try {
      const payload: any = { ruc, razon_social: razonSocial, sol_usuario: solUsuario, sol_clave: solClave, cert_clave: certClave, modo, greenter_url: greenterUrl }
      if (certPfxB64) payload.cert_pfx_b64 = certPfxB64
      const res = await fetch('/api/settings-2/integraciones/sunat-directo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Error al guardar'); return }
      setSuccess('Credenciales guardadas correctamente')
      setEstado(prev => prev ? { ...prev, configurado: true, credenciales: { ...json.credenciales, greenter_url: greenterUrl, homologacion_casos_completados: 0 } } : prev)
    } catch { setError('Error de conexión') }
    finally { setIsSaving(false) }
  }

  const handleTest = async () => {
    setIsTesting(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/settings-2/integraciones/sunat-directo/test', { method: 'POST' })
      const json = await res.json()
      if (json.ok) setSuccess(json.message ?? 'Credenciales verificadas')
      else setError(json.error ?? 'Error al verificar')
      const r2 = await fetch('/api/settings-2/integraciones/sunat-directo')
      setEstado(await r2.json())
    } catch { setError('Error de conexión') }
    finally { setIsTesting(false) }
  }

  const handleActivar = async () => {
    const res = await fetch('/api/settings-2/integraciones/sunat-directo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedor: 'sunat_directo' }),
    })
    if (res.ok) {
      setSuccess('SUNAT Directo activado como proveedor de facturación')
      setEstado(prev => prev ? { ...prev, proveedor_activo: 'sunat_directo' } : prev)
    }
  }

  const handleDesactivar = async () => {
    const res = await fetch('/api/settings-2/integraciones/sunat-directo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedor: 'nubefact' }),
    })
    if (res.ok) {
      setSuccess('Revertido a Nubefact como proveedor de facturación')
      setEstado(prev => prev ? { ...prev, proveedor_activo: 'nubefact' } : prev)
    }
  }

  const handleEliminar = async () => {
    if (!confirm('¿Eliminar las credenciales SUNAT? Esto revertirá a Nubefact.')) return
    const res = await fetch('/api/settings-2/integraciones/sunat-directo', { method: 'DELETE' })
    if (res.ok) {
      setEstado(prev => prev ? { ...prev, configurado: false, credenciales: undefined, proveedor_activo: 'nubefact' } : prev)
      setSuccess('Credenciales eliminadas')
    }
  }

  if (loading) return <div className="p-6 text-sm text-zinc-500">Cargando...</div>

  const creds = estado?.credenciales
  const estaActivo = estado?.proveedor_activo === 'sunat_directo'
  const puedeActivar = creds?.estado === 'activo' && creds.modo === 'produccion'

  return (
    <div>
      <SettingsHeader
        title="SUNAT Directo"
        description="Facturación electrónica con tu propio certificado digital — sin intermediarios"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }, { label: 'SUNAT Directo' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">

        {/* Mensajes */}
        {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}
        {success && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">{success}</div>}

        {/* Estado actual */}
        <FormSection title="Estado" description="Proveedor de facturación activo para este negocio" icon={<FileText className="w-5 h-5" />}>
          <div className="space-y-3">
            {estaActivo ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-emerald-900">SUNAT Directo ACTIVO</p>
                  <p className="text-sm text-emerald-700">Las boletas y facturas se envían directamente a SUNAT con tu certificado</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-zinc-700">Usando {estado?.proveedor_activo === 'nubefact' ? 'Nubefact' : 'otro proveedor'}</p>
                  <p className="text-sm text-zinc-500">Configura tus credenciales SUNAT y completa la homologación para activar</p>
                </div>
              </div>
            )}

            {creds && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <p className="text-zinc-500 text-xs mb-1">RUC</p>
                  <p className="font-mono font-medium">{creds.ruc}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <p className="text-zinc-500 text-xs mb-1">Estado</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    creds.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' :
                    creds.estado === 'error' ? 'bg-rose-100 text-rose-700' :
                    creds.estado === 'homologando' ? 'bg-blue-100 text-blue-700' :
                    'bg-zinc-100 text-zinc-600'
                  }`}>
                    {creds.estado === 'activo' ? '✓ Verificado' :
                     creds.estado === 'error' ? '✗ Error' :
                     creds.estado === 'homologando' ? '↻ Homologando' : '○ Pendiente'}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <p className="text-zinc-500 text-xs mb-1">Modo</p>
                  <p className="font-medium">{creds.modo === 'produccion' ? 'Producción' : 'Beta (homologación)'}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <p className="text-zinc-500 text-xs mb-1">Último test</p>
                  <p className="font-medium">{creds.ultimo_test_at ? new Date(creds.ultimo_test_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Nunca'}</p>
                </div>
                {creds.ultimo_error && (
                  <div className="col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <p className="text-rose-700 text-xs">{creds.ultimo_error}</p>
                  </div>
                )}
              </div>
            )}

            {creds && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg disabled:opacity-50"
                >
                  {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isTesting ? 'Verificando...' : 'Probar credenciales'}
                </button>

                {!estaActivo && puedeActivar && (
                  <button onClick={handleActivar} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
                    Activar SUNAT Directo
                  </button>
                )}

                {estaActivo && (
                  <button onClick={handleDesactivar} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 border border-zinc-200 rounded-lg">
                    Volver a Nubefact
                  </button>
                )}

                <button onClick={handleEliminar} className="px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg">
                  Eliminar credenciales
                </button>
              </div>
            )}
          </div>
        </FormSection>

        {/* Formulario de credenciales */}
        <FormSection
          title="Credenciales SUNAT"
          description="Datos de tu negocio y acceso al portal SOL de SUNAT"
          icon={<FileText className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">RUC del emisor *</label>
                <input
                  type="text"
                  value={ruc}
                  onChange={e => setRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="20123456789"
                  maxLength={11}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Razón social *</label>
                <input
                  type="text"
                  value={razonSocial}
                  onChange={e => setRazonSocial(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Mi Ferretería S.A.C."
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">¿Dónde obtener el usuario y clave SOL?</p>
              <p>En el portal <a href="https://sol.sunat.gob.pe" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">sol.sunat.gob.pe <ExternalLink className="w-3 h-3" /></a> con tu RUC. El usuario SOL tiene el formato <code className="bg-blue-100 px-1 rounded">MODDATOS</code> o el que te asignaron.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Usuario SOL *</label>
                <input
                  type="text"
                  value={solUsuario}
                  onChange={e => setSolUsuario(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="MODDATOS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Clave SOL *</label>
                <div className="relative">
                  <input
                    type={showSolClave ? 'text' : 'password'}
                    value={solClave}
                    onChange={e => setSolClave(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowSolClave(!showSolClave)} className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600">
                    {showSolClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-700 mb-1">Certificado digital (.pfx / .p12) *</p>
              <p className="text-xs text-zinc-500 mb-3">
                El CDT (Certificado Digital Tributario) gratuito para MYPEs lo tramitas gratis en{' '}
                <a href="https://www.sunat.gob.pe/a-sobre-sunat/cdt.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline inline-flex items-center gap-1">
                  SUNAT <ExternalLink className="w-3 h-3" />
                </a>
                {' '}— válido 3 años, disponible hasta Dic 2027.
              </p>

              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-3 p-4 border-2 border-dashed border-zinc-300 hover:border-indigo-400 rounded-lg cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-700">{certNombre || (creds ? 'Subir nuevo certificado (opcional — ya hay uno guardado)' : 'Subir certificado .pfx o .p12')}</p>
                  <p className="text-xs text-zinc-500">Click para seleccionar archivo</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden" onChange={handleFileUpload} />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Clave del certificado *</label>
              <div className="relative">
                <input
                  type={showCertClave ? 'text' : 'password'}
                  value={certClave}
                  onChange={e => setCertClave(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Contraseña del archivo .pfx"
                />
                <button type="button" onClick={() => setShowCertClave(!showCertClave)} className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600">
                  {showCertClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Modo SUNAT</label>
                <select
                  value={modo}
                  onChange={e => setModo(e.target.value as 'beta' | 'produccion')}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="beta">Beta (homologación SUNAT)</option>
                  <option value="produccion">Producción</option>
                </select>
                <p className="text-xs text-zinc-500 mt-1">SUNAT exige pasar homologación antes de pasar a producción</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">URL del microservicio</label>
                <input
                  type="url"
                  value={greenterUrl}
                  onChange={e => setGreenterUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  placeholder="https://greenter-api.byignis.com"
                />
                <p className="text-xs text-zinc-500 mt-1">URL del microservicio Greenter (compartido por la plataforma)</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleGuardar}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving ? 'Guardando...' : 'Guardar credenciales'}
              </button>
            </div>
          </div>
        </FormSection>

        {/* Guía de homologación */}
        <FormSection title="Homologación SUNAT" description="Pasos para habilitar la emisión en producción" icon={<Info className="w-5 h-5" />}>
          <ol className="space-y-3 text-sm text-zinc-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
              <span><strong>Tramita tu CDT gratuito</strong> en SUNAT (portal SOL → Certificados → CDT MYPE). Es un archivo .pfx con contraseña. Válido 3 años.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
              <span><strong>Ingresa tus datos</strong> en este formulario, sube el .pfx y guarda. Selecciona modo <em>Beta</em>.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">3</span>
              <span><strong>Prueba la conexión</strong> con el botón "Probar credenciales". Debe decir "Verificadas correctamente".</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">4</span>
              <span><strong>Emite 10 comprobantes de prueba</strong> desde el módulo de Ventas — SUNAT los recibe en modo beta y te confirma que el formato es correcto.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">5</span>
              <span><strong>Cambia a modo Producción</strong> aquí y haz clic en "Activar SUNAT Directo". Desde ese momento tus comprobantes son válidos legalmente.</span>
            </li>
          </ol>
        </FormSection>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            <strong>Seguridad:</strong> Tus credenciales se almacenan cifradas con AES-256-GCM. Ni siquiera los administradores de la plataforma pueden leer tu clave SOL o tu certificado.
          </p>
        </div>
      </div>
    </div>
  )
}
