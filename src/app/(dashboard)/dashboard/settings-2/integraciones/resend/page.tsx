'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'

interface ResendData {
  api_key_masked: string | null
  from_email: string | null
  connected: boolean
}

export default function ResendPage() {
  const [data,       setData]       = useState<ResendData | null>(null)
  const [apiKey,     setApiKey]     = useState('')
  const [fromEmail,  setFromEmail]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [msg,        setMsg]        = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings-2/integraciones/resend')
      .then(r => r.json())
      .then((d: ResendData) => {
        setData(d)
        if (d.from_email) setFromEmail(d.from_email)
      })
  }, [])

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings-2/integraciones/resend', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, from_email: fromEmail }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: json.error }); return }
      setMsg({ type: 'ok', text: 'Credenciales guardadas' })
      setData(prev => ({ ...(prev ?? { api_key_masked: null, connected: false }), from_email: fromEmail, connected: true, api_key_masked: `re_${'*'.repeat(32)}${apiKey.slice(-4)}` }))
      setApiKey('')
    } finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true); setMsg(null)
    try {
      const res = await fetch('/api/settings-2/integraciones/resend/test', { method: 'POST' })
      const json = await res.json()
      setMsg(res.ok ? { type: 'ok', text: 'Email de prueba enviado — revisa tu bandeja' } : { type: 'err', text: json.error })
    } finally { setTesting(false) }
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Resend?')) return
    await fetch('/api/settings-2/integraciones/resend', { method: 'DELETE' })
    setData({ api_key_masked: null, from_email: null, connected: false })
    setFromEmail(''); setApiKey('')
    setMsg({ type: 'ok', text: 'Resend desconectado' })
  }

  return (
    <div>
      <SettingsHeader
        title="Email (Resend)"
        description="Envía cotizaciones y notificaciones por email desde el bot"
        breadcrumbs={[
          { label: 'Configuración' },
          { label: 'Integraciones', href: '/dashboard/settings-2/integraciones' },
          { label: 'Resend' },
        ]}
      />

      <div className="p-6 max-w-xl space-y-6">
        {/* Estado de conexión */}
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${data?.connected ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200'}`}>
          {data?.connected
            ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            : <XCircle className="w-5 h-5 text-zinc-400 shrink-0" />}
          <div>
            <p className={`text-sm font-semibold ${data?.connected ? 'text-emerald-800' : 'text-zinc-600'}`}>
              {data?.connected ? 'Resend conectado' : 'No configurado'}
            </p>
            {data?.connected && (
              <p className="text-xs text-emerald-700">
                Enviando desde: {data.from_email} · API key: {data.api_key_masked}
              </p>
            )}
          </div>
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">API Key de Resend</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              placeholder={data?.api_key_masked ?? 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
            />
            <p className="text-xs text-zinc-500 mt-1">Obtén tu API key en resend.com → API Keys</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Email remitente</label>
            <input
              type="email"
              value={fromEmail}
              onChange={e => setFromEmail(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="cotizaciones@tuferreteria.com"
            />
            <p className="text-xs text-zinc-500 mt-1">Debe ser un dominio verificado en Resend</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !apiKey || !fromEmail}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 text-white text-sm font-semibold rounded-lg transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar'}
            </button>

            {data?.connected && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold rounded-lg transition"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Probar'}
              </button>
            )}

            {data?.connected && (
              <button
                onClick={handleDisconnect}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                title="Desconectar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mensaje */}
        {msg && (
          <div className={`p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {msg.text}
          </div>
        )}

        {/* Instrucciones */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <p className="text-sm font-semibold text-blue-900">¿Qué habilita Resend?</p>
          <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
            <li>El bot puede enviar cotizaciones PDF al email del cliente</li>
            <li>Notificaciones internas al dueño cuando llega un nuevo pedido</li>
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            Resend ofrece 3,000 emails/mes gratis. El dominio remitente debe estar verificado en tu cuenta de Resend.
          </p>
        </div>
      </div>
    </div>
  )
}
