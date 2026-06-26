/**
 * Notification System — Base Types
 *
 * Defines the core interfaces for the multi-channel notification system.
 * New channels (Telegram, Email, SMS, Push) only need to implement
 * the NotificationChannel interface.
 */

import type { WASender } from '@/lib/whatsapp/types'

// ── Channel Interface ────────────────────────────────────────────────────────

export interface NotificationChannel {
  /** Unique channel identifier: 'whatsapp' | 'telegram' | 'email' | etc. */
  id: string

  /** Human-readable name for UI display */
  name: string

  /** Check if this channel is configured and available for the given tenant */
  isAvailable(ctx: ChannelContext): Promise<boolean>

  /** Send a notification through this channel */
  send(params: SendParams): Promise<SendResult>
}

export interface ChannelContext {
  ferreteriaId: string
  telefonoWhatsapp?: string
  apiKey?: string
  sender?: WASender
}

export interface SendParams {
  /** Recipient identifier (phone number, email, chat ID, etc.) */
  to: string
  /** From identifier (phone number, email address, etc.) */
  from: string
  /** Formatted text message */
  message: string
  /** Channel-specific metadata (media URLs, templates, etc.) */
  metadata?: Record<string, unknown>
}

export interface SendResult {
  success: boolean
  channelId: string
  messageId?: string
  error?: string
}

// ── Broadcast Types ──────────────────────────────────────────────────────────

export interface BroadcastParams {
  to: string
  from: string
  message: string
  /** If specified, only send via these channels */
  channels?: string[]
  metadata?: Record<string, unknown>
}

// ── Delivery Notification Context ────────────────────────────────────────────

export interface DeliveryNotificationContext {
  ferreteriaId: string
  entregaId: string
  pedidoId: string
  numeroPedido: string
  nombreFerreteria: string
  telefonoWhatsapp: string
  telefonoCliente: string
  apiKey?: string
  sender?: WASender
  trackingUrl?: string
  repartidorNombre?: string
}

export type DeliveryEventType =
  | 'asignado'
  | 'en_ruta'
  | 'delay'
  | 'entregado'
  | 'fallida'
