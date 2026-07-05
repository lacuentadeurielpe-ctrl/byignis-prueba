'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, AlertCircle, CheckCircle, Loader2, Eye, EyeOff, Upload, Info, ExternalLink, Zap } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import FormSection from '../../components/FormSection'

interface EstadoSunat {
  configurado:          boolean
  proveedor_activo:     string
  negocio_ruc?:         string | null
  negocio_razon_social?: string | null
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
    sol_usuario?:                  string | null
  }
}

export default function SunatDirectoPage() {
  const [estado, setEstado] = useState<EstadoSunat | null>(null)
  const [loading, setLoading] = useState(true)

  // Formulario
  const [solUsuario, setSolUsuario] = useState('')
  const [solClave, setSolClave] = useState('')
  const [certPfxB64, setCertPfxB64] = useState('')
  const [certNombre, setCertNombre] = useState('')
  const [certClave, setCertClave] = useState('')

  const [showSolClave, setShowSolClave] = useState(false)
  const [showCertClave, setShowCertClave] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isHomologando, setIsHomologando] = useState(false)
  const [homoResultados, setHomoResultados] = useState<Array<{ok:boolean;numero?:number;numero_completo?:string;cdr_codigo?:string;error?:string}>>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings-2/integraciones/sunat-directo')
      .then(r => r.json())
      .then(d => {
        setEstado(d)
        // Pre-llenar usuario SOL con el valor guardado (descifrado por el servidor)
        if (d?.credenciales?.sol_usuario) setSolUsuario(d.credenciales.sol_usuario)
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
    if (!solUsuario || !solClave || !certClave) {
      setError('Completa todos los campos requeridos')
      return
    }
    if (!certPfxB64 && !estado?.credenciales) {
      setError('Debes subir el certificado digital (.pfx/.p12)')
      return
    }
    setIsSaving(true)
    try {
      const payload: any = { sol_usuario: solUsuario, sol_clave: solClave, cert_clave: certClave, modo: 'beta' }
      if (certPfxB64) payload.cert_pfx_b64 = certPfxB64
      const res = await fetch('/api/settings-2/integraciones/sunat-directo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Error al guardar'); return }
      setSuccess('Credenciales guardadas correctamente')
      setEstado(prev => prev ? { ...prev, configurado: true, credenciales: { ...json.credenciales, greenter_url: 'https://greenter-api-production.up.railway.app', homologacion_casos_completados: 0 } } : prev)
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

  const handleHomologar = async () => {
    setIsHomologando(true)
    setHomoResultados([])
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/settings-2/integraciones/sunat-directo/homologar', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al iniciar homologación'); return }
      setHomoResultados(json.resultados ?? [])
      // Siempre refresca el estado: el contador refleja el total acumulado en BD
      const r2 = await fetch('/api/settings-2/integraciones/sunat-directo')
      setEstado(await r2.json())
      if (json.completado) {
        setSuccess(`¡Homologación completada! ${json.exitosos}/10 boletas aceptadas por SUNAT. Tu cuenta fue actualizada automáticamente a modo Producción — haz clic en "Activar SUNAT Directo" para empezar a emitir comprobantes reales.`)
      } else {
        setError(`${json.exitosos}/10 boletas aceptadas. Vuelve a pulsar el botón para completar las ${10 - json.exitosos} restantes.`)
      }
    } catch { setError('Error de conexión') }
    finally { setIsHomologando(false) }
  }

  const handleEliminar = async () => {
    if (!confirm('¿Eliminar las credenciales SUNAT? El negocio quedará sin facturación electrónica hasta configurarlas de nuevo.')) return
    const res = await fetch('/api/settings-2/integraciones/sunat-directo', { method: 'DELETE' })
    if (res.ok) {
      setEstado(prev => prev ? { ...prev, configurado: false, credenciales: undefined } : prev)
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
                  <p className="font-medium text-zinc-700">Facturación electrónica sin activar</p>
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
                  <p className="font-medium">{creds.modo === 'produccion' ? 'Producción ✓' : 'Validación pendiente'}</p>
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

            {/* Banner "siguiente paso" cuando las credenciales están verificadas pero falta homologar */}
            {creds?.estado === 'activo' && creds.modo === 'beta' && !creds.homologacion_completada_at && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-3">
                <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-indigo-900">Siguiente paso: completar la homologación SUNAT</p>
                  <p className="text-sm text-indigo-700 mt-0.5">
                    Tus credenciales están verificadas. Falta completar la validación SUNAT enviando 10 comprobantes de prueba — el sistema lo hace automáticamente en ~2 minutos. Al terminar, tu cuenta quedará lista para facturar en producción.
                  </p>
                  <button
                    onClick={() => document.getElementById('panel-homologacion')?.scrollIntoView({ behavior: 'smooth' })}
                    className="mt-2 text-sm font-medium text-indigo-700 underline"
                  >
                    Ir al panel de homologación ↓
                  </button>
                </div>
              </div>
            )}

            {/* Banner "homologación lista — activa SUNAT Directo" */}
            {creds?.homologacion_completada_at && !estaActivo && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-900">Homologación completada — ya puedes emitir comprobantes reales</p>
                  <p className="text-sm text-emerald-700 mt-0.5">
                    Las 10 boletas de prueba fueron aceptadas por SUNAT y tu cuenta está en modo Producción.
                    Haz clic en <strong>"Activar SUNAT Directo"</strong> para que todas tus ventas usen tu certificado.
                  </p>
                </div>
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

                <button onClick={handleEliminar} className="px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg">
                  Eliminar credenciales
                </button>
              </div>
            )}
          </div>
        </FormSection>

        {/* Panel de homologación automática — visible en beta (pendiente) y en produccion (completado) */}
        {creds && creds.estado === 'activo' && (creds.modo === 'beta' || !!creds.homologacion_completada_at) && (
          <div id="panel-homologacion">
          <FormSection
            title="Homologación automática"
            description="Emite los 10 comprobantes de prueba requeridos por SUNAT antes de activar producción"
            icon={<Zap className="w-5 h-5" />}
          >
            {creds.homologacion_completada_at ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-emerald-900">Homologación completada</p>
                  <p className="text-sm text-emerald-700">
                    Las 10 boletas fueron aceptadas por SUNAT el{' '}
                    {new Date(creds.homologacion_completada_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}.
                    Tu cuenta está en modo Producción — haz clic en <strong>"Activar SUNAT Directo"</strong> para que las ventas se facturen con tus credenciales.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Barra de progreso */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-zinc-600">Comprobantes enviados a SUNAT</span>
                    <span className="text-sm font-medium text-zinc-800">{creds.homologacion_casos_completados}/10</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${(creds.homologacion_casos_completados / 10) * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-sm text-zinc-600">
                  El sistema emitirá <strong>10 boletas de prueba</strong> en modo Beta con un producto de test (S/10.00).
                  SUNAT las recibe para validar el formato XML — no tienen validez legal ni generan deuda tributaria.
                </p>

                {/* Resultados */}
                {homoResultados.length > 0 && (
                  <div className="space-y-1 max-h-52 overflow-y-auto border border-zinc-100 rounded-lg p-2">
                    {homoResultados.map((r, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 text-xs p-1.5 rounded ${
                          r.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {r.ok
                          ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span>
                          {r.ok
                            ? `✓ ${r.numero_completo} — CDR ${r.cdr_codigo ?? '?'}`
                            : `✗ Boleta ${r.numero}: ${r.error}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleHomologar}
                  disabled={isHomologando}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isHomologando
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Zap className="w-4 h-4" />}
                  {isHomologando ? 'Emitiendo comprobantes de prueba... (puede tardar ~2 min)' : 'Emitir 10 boletas de prueba ahora'}
                </button>

                <p className="text-xs text-zinc-400">
                  El proceso tarda ~1-2 minutos. No cierres la página. Las boletas en modo Beta no tienen validez legal.
                </p>
              </div>
            )}
          </FormSection>
          </div>
        )}

        {/* Formulario de credenciales */}
        <FormSection
          title="Credenciales SUNAT"
          description="Datos de tu negocio y acceso al portal SOL de SUNAT"
          icon={<FileText className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {/* RUC y Razón Social — solo lectura, vienen de Negocio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1">RUC del emisor</label>
                <div className="px-3 py-2 border border-zinc-200 bg-zinc-50 rounded-lg font-mono text-sm text-zinc-800">
                  {estado?.negocio_ruc || estado?.credenciales?.ruc || <span className="text-zinc-400 italic">No configurado</span>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1">Razón social</label>
                <div className="px-3 py-2 border border-zinc-200 bg-zinc-50 rounded-lg text-sm text-zinc-800 truncate">
                  {estado?.negocio_razon_social || estado?.credenciales?.razon_social || <span className="text-zinc-400 italic">No configurada</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Estos datos se toman de{' '}
              <a href="/dashboard/settings-2/negocio" className="text-indigo-600 hover:underline">Configuración → Negocio</a>.
              Edítalos allí si necesitas cambiarlos.
            </p>

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
                {creds?.sol_usuario && solUsuario === creds.sol_usuario && (
                  <p className="text-xs text-emerald-600 mt-1">✓ Guardado: {creds.sol_usuario}</p>
                )}
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

        {/* Guía de activación */}
        <FormSection title="Cómo activar SUNAT Directo" description="Sigue estos pasos en orden — el paso 3 es obligatorio o SUNAT rechazará tus comprobantes" icon={<Info className="w-5 h-5" />}>
          <ol className="space-y-3 text-sm text-zinc-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
              <span>
                <strong>Crea un usuario secundario en SUNAT SOL y asígnale permisos.</strong> Es lo primero que debes hacer, antes de sacar el certificado. Entra con tu Clave SOL de RUC a <em>SUNAT Operaciones en Línea → Empresas → Administración del RUC → Usuarios secundarios</em>, crea el usuario y en sus permisos activa al menos <strong>“Comprobantes de pago”</strong> (SEE – Del Contribuyente) y <strong>“Certificado Digital”</strong>. Así no expones tu Clave SOL principal para la facturación diaria.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
              <span><strong>Consigue tu certificado digital.</strong> Puede ser el CDT gratuito para MYPE (SUNAT SOL → Certificado Digital Tributario) o uno de una entidad autorizada. Es un archivo <em>.pfx</em> con contraseña.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">3</span>
              <span>
                <strong>Habilita tu perfil de emisor electrónico en SUNAT SOL</strong> (paso obligatorio — sin esto SUNAT rechaza con error <em>0111 “no tiene el perfil”</em>). Entra a <em>Empresas → Comprobantes de pago → SEE – Del Contribuyente → Certificado Digital → Registro y Mantenimiento de Correo y Certificados Digitales</em> y ahí:
                <ul className="mt-1 ml-1 list-disc list-inside space-y-0.5 text-zinc-600">
                  <li>Marca <strong>“Deseo emitir a través del SEE – Del Contribuyente”</strong>.</li>
                  <li><strong>Registra y confirma tu correo electrónico</strong> — SUNAT te envía un código de verificación al email; ingrésalo para confirmarlo.</li>
                  <li><strong>Registra tu certificado digital</strong> (el mismo .pfx que subirás aquí).</li>
                </ul>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">4</span>
              <span><strong>Ingresa tus datos aquí</strong>, sube el .pfx con su contraseña y guarda.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">5</span>
              <span><strong>Prueba la conexión</strong> con “Probar credenciales”. Debe decir “Verificadas correctamente”.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">6</span>
              <span><strong>Clic en “Emitir 10 boletas de prueba ahora”.</strong> El sistema completa la validación con SUNAT automáticamente y tu cuenta pasa sola a modo Producción.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">7</span>
              <span><strong>Haz clic en “Activar SUNAT Directo”.</strong> Desde ese momento tus boletas y facturas se emiten con tu certificado, válidas ante SUNAT, desde Ventas, POS y el bot de WhatsApp.</span>
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
