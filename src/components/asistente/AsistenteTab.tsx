'use client'

import ChatPanel from './ChatPanel'
import SessionSummaryPanel from './SessionSummaryPanel'
import { useAsistente } from './useAsistente'

export default function AsistenteTab() {
  const {
    messages,
    isLoading,
    sendMessage,
    clearSession,
    cancelRequest,
  } = useAsistente()

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
      {/* Chat — 58% */}
      <div className="flex-[3] min-w-0 border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onCancel={cancelRequest}
          onClear={clearSession}
        />
      </div>

      {/* Resumen de sesión — 42% */}
      <div className="flex-[2] min-w-0 border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <SessionSummaryPanel messages={messages} />
      </div>
    </div>
  )
}
