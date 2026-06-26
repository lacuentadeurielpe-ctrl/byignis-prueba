'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle, AlertCircle, Copy, Check, Eye, EyeOff,
  Phone, ExternalLink, Info, RefreshCw,
} from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'

interface MetaStatus {
  estado?: string
  numero_whatsapp?: string | null
  phone_number_id?: string | null
  waba_id?: string | null
  webhook_verify_token?: string | null
  ultimo_mensaje_at?: string | null
  ultimo_error?: string | null
  ultimo_error_at?: string | null
}

// ── Componentes reutilizables ────────────────────────────────────────────────

function CopyBox({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-zinc-700 font-mono bg-white border border-zinc-200 rounded-lg px-3 py-2 truncate">
          {value}
        </code>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 transition whitespace-nowrap"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {hint && <p className="text-xs text-zinc-400 mt-2">{hint}</p>}
    </div>
  )
}

function SecretInput({
  value, onChange, placeholder, label, hint, required,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  hint?: string
  required?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pr-24 pl-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition bg-white"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, label, hint, required,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  hint?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition bg-white"
      />
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </div>
  )
}

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 15)
    onChange(digits)
  }
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">
        Número de WhatsApp visible
        <span className="ml-1 text-rose-500">*</span>
      </label>
      <div className="flex items-center border border-zinc-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent transition">
        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-50 border-r border-zinc-200 text-sm text-zinc-500 whitespace-nowrap">
          <Phone className="w-3.5 h-3.5" />
          <span>+</span>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          placeholder="51987654321"
          className="flex-1 px-3 py-2.5 text-sm bg-white focus:outline-none"
        />
        {value && (
          <span className="px-3 text-xs text-zinc-400 whitespace-nowrap">+{value}</span>
        )}
      </div>
      <p className="text-xs text-zinc-400 mt-1">
        El número que ven tus clientes al escribirles. Incluye código de país sin +. Ej: <span className="font-mono">51987654321</span>
      </p>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function MetaWhatsAppPage() {
  const [status, setStatus] = useState<MetaStatus>({})
  const [loading, setLoading] = useState(true)

  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [phone, setPhone] = useState('')

  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/settings-2/integraciones/meta')
      .then(r => r.ok ? r.json() : {})
      .then((d: MetaStatus) => {
        setStatus(d)
        if (d.phone_number_id) setPhoneNumberId(d.phone_number_id)
        if (d.waba_id) setWabaId(d.waba_id)
        if (d.numero_whatsapp) setPhone(d.numero_whatsapp.replace(/^\+/, ''))
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleConnect() {
    if (!phoneNumberId.trim()) { setServerError('Phone Number ID es requerido'); return }
    if (!accessToken.trim()) { setServerError('Access Token es requerido'); return }
    if (!phone.trim()) { setServerError('Número de WhatsApp es requerido'); return }

    setSaving(true)
    setServerError('')
    setSuccess('')

    const res = await fetch('/api/settings-2/integraciones/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number_id: phoneNumberId.trim(),
        access_token:    accessToken.trim(),
        waba_id:         wabaId.trim() || undefined,
        numero_whatsapp: phone,
      }),
    })

    if (res.ok) {
      // Recargar para obtener el webhook_verify_token generado
      const updated = await fetch('/api/settings-2/integraciones/meta').then(r => r.json())
      setStatus({ ...updated, estado: 'conectado' })
      setSuccess('Meta WhatsApp conectado correctamente. Configura el webhook en Meta Developer Console con los datos de abajo.')
      setAccessToken('')  // limpiar el token de la UI por seguridad
    } else {
      const data = await res.json()
      setServerError(data.error || 'Error al guardar')
    }
    setSaving(false)
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Meta WhatsApp? El bot dejará de responder mensajes por esta vía.')) return
    setSaving(true)
    await fetch('/api/settings-2/integraciones/meta', { method: 'DELETE' })
    setStatus({ estado: 'desconectado' })
    setPhoneNumberId('')
    setAccessToken('')
    setWabaId('')
    setPhone('')
    setSuccess('')
    setServerError('')
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-sm text-zinc-400">Cargando...</div>

  const connected = status?.estado === 'conectado'
  const hasError  = status?.estado === 'error'
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/meta`
    : 'https://app.ferrobot.pe/api/webhook/meta'

  return (
    <div>
      <SettingsHeader
        title="Meta WhatsApp Cloud API"
        description="Conexión oficial con WhatsApp Business a través de la API de Meta"
        breadcrumbs={[
          { label: 'Configuración' },
          { label: 'Integraciones' },
          { label: 'Meta WhatsApp' },
        ]}
      />

      <div className="p-6 max-w-2xl space-y-6">

        {/* Prioridad */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-200 bg-blue-50">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-0.5">Meta es el proveedor principal</p>
            <p className="text-xs text-blue-700">
              Si Meta está activo, el bot lo usará siempre. YCloud queda como respaldo automático solo si Meta está desconectado.
              Ambos proveedores comparten exactamente el mismo bot, el mismo catálogo y el mismo sistema multi-agente.
            </p>
          </div>
        </div>

        {/* Estado */}
        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
          connected ? 'bg-emerald-50 border-emerald-200'
          : hasError ? 'bg-rose-50 border-rose-200'
          : 'bg-amber-50 border-amber-200'
        }`}>
          {connected
            ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            : <AlertCircle className={`w-5 h-5 mt-0.5 shrink-0 ${hasError ? 'text-rose-600' : 'text-amber-600'}`} />}
          <div className="flex-1">
            <p className={`text-sm font-semibold ${connected ? 'text-emerald-900' : hasError ? 'text-rose-900' : 'text-amber-900'}`}>
              {connected ? 'Conectado' : hasError ? 'Error de conexión' : 'Desconectado'}
            </p>
            <p className={`text-xs mt-0.5 ${connected ? 'text-emerald-700' : hasError ? 'text-rose-700' : 'text-amber-700'}`}>
              {connected
                ? `Número activo: +${status.numero_whatsapp ?? '—'} · Último mensaje: ${status.ultimo_mensaje_at ? new Date(status.ultimo_mensaje_at).toLocaleString('es-PE') : 'sin mensajes aún'}`
                : hasError
                  ? `Error: ${status.ultimo_error ?? 'desconocido'}`
                  : 'Configura tus credenciales para activar el bot de WhatsApp con Meta'}
            </p>
          </div>
        </div>

        {/* Formulario de credenciales */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Credenciales de la API</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Obtén estos datos en{' '}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
              >
                Meta Developer Console <ExternalLink className="w-3 h-3" />
              </a>
              {' '}→ tu App → WhatsApp → Configuración de la API
            </p>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {serverError}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          <PhoneInput value={phone} onChange={setPhone} />

          <TextInput
            label="Phone Number ID"
            value={phoneNumberId}
            onChange={setPhoneNumberId}
            placeholder="123456789012345"
            hint="ID numérico del número en Meta — se ve en la pestaña 'Números de teléfono' de tu WABA. No es el número de teléfono en sí."
            required
          />

          <SecretInput
            label="Access Token (permanente)"
            value={accessToken}
            onChange={setAccessToken}
            placeholder="EAAxxxxxxx..."
            hint={connected
              ? 'Dejar vacío si no quieres actualizar el token guardado.'
              : 'Token de sistema (System User Token) de larga duración. Se encripta antes de guardarse.'}
            required={!connected}
          />

          <TextInput
            label="WABA ID (opcional)"
            value={wabaId}
            onChange={setWabaId}
            placeholder="123456789012345"
            hint="WhatsApp Business Account ID — útil para auditoría pero no requerido para el funcionamiento."
          />

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving || !phoneNumberId.trim() || (!accessToken.trim() && !connected) || !phone.trim()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-40 transition"
            >
              {saving ? (
                <span className="flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...</span>
              ) : connected ? 'Actualizar' : 'Conectar'}
            </button>
            {connected && (
              <button
                onClick={handleDisconnect}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 disabled:opacity-40 transition"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>

        {/* Configuración del webhook en Meta */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Configurar Webhook en Meta</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              En Meta Developer Console → tu App → WhatsApp → Configuración → Webhooks, ingresa estos datos:
            </p>
          </div>

          <CopyBox
            label="URL del Callback"
            value={webhookUrl}
            hint="Pega esta URL en el campo 'URL de Callback' del webhook de Meta."
          />

          {status.webhook_verify_token ? (
            <CopyBox
              label="Token de verificación"
              value={status.webhook_verify_token}
              hint="Pega este token en el campo 'Token de verificación' de Meta. Es único por cuenta y se genera automáticamente."
            />
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs text-zinc-500">
                El token de verificación se mostrará aquí una vez que guardes tus credenciales.
              </p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800">
              <strong>Suscripciones requeridas:</strong> En la sección de Webhooks, suscríbete a los eventos:{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">messages</code>{' '}
              y{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">message_deliveries</code>
            </p>
          </div>
        </div>

        {/* Guía paso a paso */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Guía de configuración</h3>
          <ol className="space-y-3">
            {[
              { n: 1, t: 'Crea una App en Meta for Developers', d: 'Tipo: Business. Agrega el producto "WhatsApp".' },
              { n: 2, t: 'Configura tu WABA', d: 'En WhatsApp → Empezar, conecta o crea tu WhatsApp Business Account y agrega un número.' },
              { n: 3, t: 'Genera un token de sistema permanente', d: 'En Configuración de negocio → Usuarios del sistema, crea un usuario con rol Admin y genera un token con permiso whatsapp_business_messaging.' },
              { n: 4, t: 'Copia el Phone Number ID', d: 'En WhatsApp → Números de teléfono, copia el ID numérico (no el número).' },
              { n: 5, t: 'Guarda las credenciales arriba y luego configura el webhook', d: 'Primero guarda para obtener el token de verificación, luego ve a WhatsApp → Configuración y registra el webhook.' },
            ].map(step => (
              <li key={step.n} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{step.t}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

      </div>
    </div>
  )
}
