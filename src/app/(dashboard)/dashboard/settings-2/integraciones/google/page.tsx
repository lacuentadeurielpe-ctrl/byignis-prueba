'use client'

import { useState, useEffect } from 'react'
import { Globe2, CheckCircle, XCircle, Loader2, Trash2, Mail, Calendar, HardDrive } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface GoogleData {
  estado:       string
  email?:       string
  conectado_at?: string
  calendar_id?: string
}

function GooglePageContent() {
  const params   = useSearchParams()
  const [data,    setData]    = useState<GoogleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (params.get('ok'))    setMsg({ type: 'ok',  text: 'Google conectado correctamente' })
    if (params.get('error')) setMsg({ type: 'err', text: 'Error al conectar Google — intenta de nuevo' })

    fetch('/api/settings-2/integraciones/google')
      .then(r => r.json())
      .then((d: GoogleData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [params])

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Google? El bot dejará de poder usar Gmail, Calendar y Drive.')) return
    await fetch('/api/settings-2/integraciones/google', { method: 'DELETE' })
    setData({ estado: 'desconectado' })
    setMsg({ type: 'ok', text: 'Google desconectado' })
  }

  const isConnected = data?.estado === 'conectado'

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      {/* Estado */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${isConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200'}`}>
        {isConnected
          ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          : <XCircle    className="w-5 h-5 text-zinc-400 shrink-0" />}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isConnected ? 'text-emerald-800' : 'text-zinc-600'}`}>
            {isConnected ? `Google conectado — ${data?.email}` : 'Google no conectado'}
          </p>
          {isConnected && data?.conectado_at && (
            <p className="text-xs text-emerald-700">
              Conectado el {new Date(data.conectado_at).toLocaleDateString('es-PE')}
            </p>
          )}
        </div>
        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
            title="Desconectar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* CTA conectar */}
      {!isConnected && (
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-zinc-200 hover:border-indigo-400 hover:bg-indigo-50 text-zinc-700 text-sm font-semibold rounded-xl transition"
        >
          <Globe2 className="w-5 h-5 text-indigo-500" />
          Conectar con Google
        </a>
      )}

      {/* Qué habilita */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-indigo-900">Con Google conectado el bot puede:</p>
        <div className="space-y-2">
          {[
            { icon: Mail,     label: 'Gmail',           desc: 'Enviar cotizaciones, confirmaciones y recordatorios de pago al email del cliente' },
            { icon: Calendar, label: 'Google Calendar', desc: 'Crear eventos de entrega y citas de visita técnica automáticamente' },
            { icon: HardDrive,label: 'Google Drive',    desc: 'Guardar PDFs de cotizaciones y comprobantes en una carpeta FerroBot' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-indigo-800">{label}: </span>
                <span className="text-xs text-indigo-700">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nota de permisos */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <strong>Permisos solicitados:</strong> Solo enviar emails (no lee tu bandeja), crear/editar eventos de calendario, y subir archivos a Drive. FerroBot nunca accede a tus emails existentes ni archivos previos.
        </p>
      </div>

      {/* Mensaje */}
      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

export default function GoogleIntegracionPage() {
  return (
    <div>
      <SettingsHeader
        title="Google (Gmail · Calendar · Drive)"
        description="Un solo login activa email, calendario y almacenamiento en la nube"
        breadcrumbs={[
          { label: 'Configuración' },
          { label: 'Integraciones', href: '/dashboard/settings-2/integraciones' },
          { label: 'Google' },
        ]}
      />
      <Suspense fallback={<div className="p-6 text-zinc-500 text-sm">Cargando...</div>}>
        <GooglePageContent />
      </Suspense>
    </div>
  )
}
