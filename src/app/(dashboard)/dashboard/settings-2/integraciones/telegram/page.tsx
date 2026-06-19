'use client'

import { useState, useEffect } from 'react'
import { Send, AlertCircle, CheckCircle } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import FormSection from '../../components/FormSection'
import ToolsEnabledSection from '../components/ToolsEnabledSection'

interface TelegramData {
  conectado: boolean
  chat_id: string | null
  token_preview: string | null
}

export default function TelegramPage() {
  const [data,       setData]       = useState<TelegramData | null>(null)
  const [token,      setToken]      = useState('')
  const [chatId,     setChatId]     = useState('')
  const [isSaving,   setIsSaving]   = useState(false)
  const [isTesting,  setIsTesting]  = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')

  useEffect(() => {
    fetch('/api/settings-2/integraciones/telegram')
      .then((r) => r.json())
      .then((d: TelegramData) => {
        setData(d)
        if (d.chat_id) setChatId(d.chat_id)
      })
      .catch(() => setError('Error cargando configuración'))
  }, [])

  async function handleSave() {
    setIsSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/settings-2/integraciones/telegram', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token || undefined, chat_id: chatId || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error guardando'); return }
      setData(json)
      setToken('')
      setSuccess('Credenciales guardadas correctamente')
    } catch {
      setError('Error de conexión')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTest() {
    setIsTesting(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/settings-2/integraciones/telegram/test', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error en prueba'); return }
      setSuccess('Mensaje de prueba enviado a Telegram')
    } catch {
      setError('Error de conexión al probar')
    } finally {
      setIsTesting(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Telegram?')) return
    setIsSaving(true)
    try {
      await fetch('/api/settings-2/integraciones/telegram', { method: 'DELETE' })
      setData({ conectado: false, chat_id: null, token_preview: null })
      setToken(''); setChatId('')
      setSuccess('Telegram desconectado')
    } catch {
      setError('Error al desconectar')
    } finally {
      setIsSaving(false)
    }
  }

  const isConnected = data?.conectado ?? false

  return (
    <div>
      <SettingsHeader
        title="Telegram"
        description="Notificaciones al canal o grupo de tu tienda vía Telegram Bot"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }, { label: 'Telegram' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Estado */}
        <FormSection
          title="Estado de Conexión"
          description="Estado actual del bot de Telegram"
          icon={<Send className="w-5 h-5" />}
        >
          {isConnected ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-emerald-900">Conectado</p>
                <p className="text-sm text-emerald-700">
                  Chat ID: <code className="font-mono bg-emerald-100 px-1 rounded">{data?.chat_id}</code>
                  {data?.token_preview && (
                    <span className="ml-2 text-emerald-600">· Token: {data.token_preview}</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-900">No conectado</p>
                <p className="text-sm text-amber-700">Configura tu bot de Telegram para recibir notificaciones</p>
              </div>
            </div>
          )}
        </FormSection>

        {/* Formulario */}
        <FormSection
          title="Credenciales"
          description="Token del bot y Chat ID del canal/grupo donde se enviarán las notificaciones"
          icon={<Send className="w-5 h-5" />}
          isDirty
        >
          <div className="space-y-4">
            {error   && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}
            {success && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">{success}</div>}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Bot Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                placeholder={isConnected ? `Actual: ${data?.token_preview} — dejar vacío para no cambiar` : '1234567890:ABCDefGhIJKlmNOPqrsTUVwxyz12345678'}
              />
              <p className="text-xs text-zinc-500 mt-1">Obtenlo hablando con <code>@BotFather</code> en Telegram → /newbot</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Chat ID</label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                placeholder="-1001234567890"
              />
              <p className="text-xs text-zinc-500 mt-1">
                ID del canal o grupo (negativo = grupo/canal). Agrega el bot al grupo, luego usa <code>@userinfobot</code> para obtener el ID.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving || (!token && !chatId)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>

              {isConnected && (
                <>
                  <button
                    onClick={handleTest}
                    disabled={isTesting}
                    className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 disabled:opacity-50"
                  >
                    {isTesting ? 'Enviando...' : 'Enviar prueba'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                </>
              )}
            </div>
          </div>
        </FormSection>

        {/* Herramientas que activa */}
        <ToolsEnabledSection integracionId="telegram" isConnected={isConnected} />

        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm text-blue-900 font-medium">¿Cómo configurarlo?</p>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Abre Telegram y habla con <strong>@BotFather</strong> → <code>/newbot</code> → copia el token.</li>
            <li>Crea un grupo o canal, agrega tu bot como administrador.</li>
            <li>Usa <strong>@userinfobot</strong> en ese grupo para obtener el Chat ID (número negativo).</li>
            <li>Pega token y Chat ID aquí, guarda y envía una prueba.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
