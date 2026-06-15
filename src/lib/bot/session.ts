// Gestión de sesiones de conversación utilizando el ChatRepository
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conversacion, Cliente } from '@/types/database'
import { ChatRepository } from '@/lib/db/repositories/chat'

interface GetOrCreateSessionResult {
  conversacion: Conversacion
  cliente: Cliente
  esNueva: boolean
}

export async function getOrCreateSession(
  supabase: SupabaseClient,
  ferreteriaId: string,
  telefonoCliente: string,
  _timeoutSesionMinutos: number // mantenido por firma
): Promise<GetOrCreateSessionResult> {
  const repo = new ChatRepository(supabase)

  // 1. Obtener o crear cliente
  let cliente = await repo.obtenerClientePorTelefono(ferreteriaId, telefonoCliente)
  if (!cliente) {
    cliente = await repo.crearCliente(ferreteriaId, telefonoCliente)
  }

  // 2. Buscar la conversación más reciente
  const conversacionExistente = await repo.obtenerConversacionReciente(ferreteriaId, cliente.id)

  if (conversacionExistente) {
    const esCerrada = conversacionExistente.estado === 'cerrada'
    await repo.reabrirConversacion(conversacionExistente.id, esCerrada)

    return {
      conversacion: {
        ...conversacionExistente,
        ultima_actividad: new Date().toISOString(),
        ...(esCerrada ? { estado: 'activa', bot_pausado: false } : {}),
      },
      cliente,
      esNueva: false,
    }
  }

  // 3. Crear conversación
  const nuevaConversacion = await repo.crearConversacion(ferreteriaId, cliente.id)
  return { conversacion: nuevaConversacion, cliente, esNueva: true }
}

export async function guardarMensaje(
  supabase: SupabaseClient,
  conversacionId: string,
  role: 'cliente' | 'bot' | 'dueno',
  contenido: string,
  ycloudMessageId?: string
) {
  const repo = new ChatRepository(supabase)
  await repo.guardarMensaje({ conversacionId, role, contenido, ycloudMessageId })
}

export async function getHistorial(
  supabase: SupabaseClient,
  conversacionId: string,
  limite: number
): Promise<{ role: 'cliente' | 'bot' | 'dueno'; contenido: string }[]> {
  const repo = new ChatRepository(supabase)
  return repo.obtenerHistorial(conversacionId, limite)
}

export async function verificarRetomarBot(
  supabase: SupabaseClient,
  conversacion: Conversacion,
  timeoutIntervencionMinutos: number
): Promise<boolean> {
  if (!conversacion.bot_pausado) return false
  if (!conversacion.dueno_activo_at) return true

  const limiteIntervacion = new Date(
    Date.now() - timeoutIntervencionMinutos * 60 * 1000
  ).toISOString()

  const duenoTardio = conversacion.dueno_activo_at < limiteIntervacion

  if (duenoTardio) {
    const repo = new ChatRepository(supabase)
    await repo.reactivarBot(conversacion.id)
    return true
  }

  return false
}

export async function pausarBot(supabase: SupabaseClient, conversacionId: string) {
  const repo = new ChatRepository(supabase)
  await repo.pausarBot(conversacionId)
}

export async function mensajeYaProcesado(
  supabase: SupabaseClient,
  ycloudMessageId: string
): Promise<boolean> {
  const repo = new ChatRepository(supabase)
  return repo.mensajeYaProcesado(ycloudMessageId)
}

export async function pausarBotPorDueno(
  supabase: SupabaseClient,
  ferreteriaId: string,
  telefonoCliente: string
): Promise<void> {
  const repo = new ChatRepository(supabase)
  const cliente = await repo.obtenerClientePorTelefono(ferreteriaId, telefonoCliente)
  if (!cliente) return

  const conv = await repo.obtenerConversacionReciente(ferreteriaId, cliente.id)
  if (!conv || !['activa', 'intervenida_dueno'].includes(conv.estado)) return

  await repo.pausarBot(conv.id)
}

export async function yaEnvioMensajeFueraHorario(
  supabase: SupabaseClient,
  conversacionId: string
): Promise<boolean> {
  const repo = new ChatRepository(supabase)
  return repo.yaEnvioMensajeFueraHorario(conversacionId)
}

// ── Control de pausa mejorado ────────────────────────────────────────────────

export type MotivoPausa = 'owner_dashboard' | 'owner_ycloud' | 'ia_escalation' | 'cliente_pidio'

// Pausa el bot con motivo opcional y timer opcional (minutos hasta auto-reanudar)
export async function pausarBotConMotivo(
  supabase: SupabaseClient,
  conversacionId: string,
  motivo: MotivoPausa = 'owner_dashboard',
  minutos?: number
): Promise<void> {
  const ahora = new Date().toISOString()
  const hasta = minutos ? new Date(Date.now() + minutos * 60 * 1000).toISOString() : null

  await supabase
    .from('conversaciones')
    .update({
      bot_pausado: true,
      bot_pausado_hasta: hasta,
      bot_pausado_motivo: motivo,
      pausado_at: ahora,
      dueno_activo_at: ahora,
    })
    .eq('id', conversacionId)
}

// Reanuda el bot manualmente (limpia todos los campos de pausa)
export async function reanudarBot(
  supabase: SupabaseClient,
  conversacionId: string
): Promise<void> {
  await supabase
    .from('conversaciones')
    .update({
      bot_pausado: false,
      bot_pausado_hasta: null,
      bot_pausado_motivo: null,
      pausado_at: null,
      dueno_activo_at: null,
    })
    .eq('id', conversacionId)
}

// Verifica si hay un timer de auto-reanudación expirado y lo aplica.
// Devuelve true si el bot fue reactivado automáticamente.
export async function verificarAutoReanudar(
  supabase: SupabaseClient,
  conversacionId: string,
  botPausadoHasta: string | null
): Promise<boolean> {
  if (!botPausadoHasta) return false
  if (new Date(botPausadoHasta) > new Date()) return false

  await reanudarBot(supabase, conversacionId)
  return true
}
