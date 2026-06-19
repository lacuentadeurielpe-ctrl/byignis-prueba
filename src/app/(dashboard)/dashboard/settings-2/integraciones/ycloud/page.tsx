'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Copy, Check, Eye, EyeOff, Phone } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import ToolsEnabledSection from '../components/ToolsEnabledSection'

interface YCloudStatus {
  estado?: string
  numero_whatsapp?: string | null
  configurado_at?: string | null
  ultimo_mensaje_at?: string | null
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-rose-600 mt-1">{msg}</p>
}

function SecretInput({
  value, onChange, placeholder, label, hint,
}: { value: string; onChange: (v: string) => void; placeholder: string; label: string; hint?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pr-20 pl-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition bg-white"
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

function PhoneInput({
  value, onChange, error,
}: { value: string; onChange: (v: string) => void; error?: string }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Solo dígitos, máx 15
    const digits = e.target.value.replace(/\D/g, '').slice(0, 15)
    onChange(digits)
  }

  const formatted = value ? `+${value}` : ''

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">
        Número de WhatsApp
        <span className="ml-1 text-rose-500">*</span>
      </label>
      <div className={`flex items-center border rounded-xl overflow-hidden transition ${error ? 'border-rose-400 ring-1 ring-rose-300' : 'border-zinc-200 focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent'}`}>
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
        {formatted && (
          <span className="px-3 text-xs text-zinc-400 whitespace-nowrap">{formatted}</span>
        )}
      </div>
      <p className="text-xs text-zinc-400 mt-1">
        Incluye código de país sin el +. Ej: <span className="font-mono">51987654321</span> para Perú
      </p>
      <FieldError msg={error} />
    </div>
  )
}

function WebhookUrlBox() {
  const [copied, setCopied] = useState(false)
  const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://www.uintegrus.com'}/api/webhook/ycloud`

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">URL del Webhook</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-zinc-700 font-mono bg-white border border-zinc-200 rounded-lg px-3 py-2 truncate">
          {url}
        </code>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 transition whitespace-nowrap"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="text-xs text-zinc-400 mt-2">
        Pega esta URL en el panel de YCloud → tu número → Webhook
      </p>
    </div>
  )
}

export default function YCloudPage() {
  const [status, setStatus] = useState<YCloudStatus>({})
  const [loading, setLoading] = useState(true)

  const [apiKey, setApiKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/settings-2/integraciones/ycloud')
      .then(r => r.ok ? r.json() : {})
      .then((d: YCloudStatus) => {
        setStatus(d)
        if (d.numero_whatsapp) setPhone(d.numero_whatsapp.replace(/^\+/, ''))
      })
      .finally(() => setLoading(false))
  }, [])

  function validatePhone(value: string) {
    if (!value) return 'El número de WhatsApp es requerido'
    if (value.length < 8) return 'El número parece muy corto'
    return ''
  }

  async function handleConnect() {
    const err = validatePhone(phone)
    if (err) { setPhoneError(err); return }
    if (!apiKey.trim()) { setServerError('La API Key es requerida'); return }

    setSaving(true)
    setServerError('')
    setSuccess('')
    setPhoneError('')

    const res = await fetch('/api/settings-2/integraciones/ycloud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey.trim(), webhook_secret: webhookSecret.trim() || undefined, telefono_whatsapp: phone }),
    })

    if (res.ok) {
      setStatus({ ...status, estado: 'conectado', numero_whatsapp: phone })
      setSuccess('YCloud conectado. Asegúrate de configurar la URL del webhook en tu panel de YCloud.')
    } else {
      const data = await res.json()
      setServerError(data.error || 'Error al guardar')
    }
    setSaving(false)
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar YCloud? El bot dejará de responder mensajes.')) return
    setSaving(true)
    await fetch('/api/settings-2/integraciones/ycloud', { method: 'DELETE' })
    setStatus({ estado: 'desconectado' })
    setApiKey('')
    setWebhookSecret('')
    setPhone('')
    setSuccess('')
    setServerError('')
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-sm text-zinc-400">Cargando...</div>

  const connected = status?.estado === 'conectado'

  return (
    <div>
      <SettingsHeader
        title="YCloud"
        description="API WhatsApp para mensajes bidireccionales"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }, { label: 'YCloud' }]}
      />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Herramientas que activa */}
        <ToolsEnabledSection integracionId="ycloud" isConnected={connected} />

        {/* Estado */}
        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          {connected
            ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />}
          <div>
            <p className={`text-sm font-semibold ${connected ? 'text-emerald-900' : 'text-amber-900'}`}>
              {connected ? 'Conectado' : 'Desconectado'}
            </p>
            <p className={`text-xs mt-0.5 ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>
              {connected
                ? `Número activo: +${status.numero_whatsapp ?? '—'}`
                : 'Configura tus credenciales para activar el bot de WhatsApp'}
            </p>
          </div>
        </div>

        {/* Webhook URL */}
        <WebhookUrlBox />

        {/* Formulario */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Credenciales</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Obtén estos datos desde tu panel de YCloud</p>
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

          <PhoneInput value={phone} onChange={v => { setPhone(v); if (phoneError) setPhoneError('') }} error={phoneError} />

          <SecretInput
            label="API Key"
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk_live_..."
            hint="Encriptada antes de guardarse"
          />

          <SecretInput
            label="Webhook Secret (opcional)"
            value={webhookSecret}
            onChange={setWebhookSecret}
            placeholder="Déjalo vacío si no usas verificación HMAC"
          />

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving || !apiKey.trim()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-40 transition"
            >
              {saving ? 'Guardando...' : connected ? 'Actualizar' : 'Conectar'}
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
      </div>
    </div>
  )
}
