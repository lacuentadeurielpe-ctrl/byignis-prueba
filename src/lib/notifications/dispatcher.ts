/**
 * Notification Dispatcher — Central orchestrator
 *
 * Manages registered channels and dispatches notifications.
 * Channels self-report availability; the dispatcher sends to all available ones.
 *
 * Usage:
 *   const dispatcher = createDispatcher()
 *   const results = await dispatcher.broadcast({ to, from, message })
 */

import type {
  NotificationChannel,
  ChannelContext,
  BroadcastParams,
  SendParams,
  SendResult,
} from './types'
import { WhatsAppChannel } from './channels/whatsapp.channel'
import { TelegramChannel } from './channels/telegram.channel'
import { EmailChannel } from './channels/email.channel'

export class NotificationDispatcher {
  private channels: NotificationChannel[] = []

  /** Register a notification channel */
  register(channel: NotificationChannel): void {
    // Prevent duplicate registrations
    if (this.channels.some(c => c.id === channel.id)) return
    this.channels.push(channel)
  }

  /** Get all registered channels */
  getChannels(): NotificationChannel[] {
    return [...this.channels]
  }

  /** Get available channels for a given tenant context */
  async getAvailableChannels(ctx: ChannelContext): Promise<NotificationChannel[]> {
    const checks = await Promise.all(
      this.channels.map(async ch => ({
        channel: ch,
        available: await ch.isAvailable(ctx).catch(() => false),
      })),
    )
    return checks.filter(c => c.available).map(c => c.channel)
  }

  /**
   * Broadcast a notification to ALL available channels.
   * Returns results for each channel attempted.
   */
  async broadcast(
    params: BroadcastParams,
    ctx: ChannelContext,
  ): Promise<SendResult[]> {
    const available = await this.getAvailableChannels(ctx)

    // If specific channels requested, filter
    const targets = params.channels
      ? available.filter(ch => params.channels!.includes(ch.id))
      : available

    if (targets.length === 0) return []

    const results = await Promise.allSettled(
      targets.map(ch =>
        ch.send({
          to: params.to,
          from: params.from,
          message: params.message,
          metadata: params.metadata,
        }),
      ),
    )

    return results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            success: false,
            channelId: targets[i].id,
            error: r.reason?.message ?? 'Channel send failed',
          },
    )
  }

  /**
   * Send via a specific channel by ID.
   */
  async sendVia(channelId: string, params: SendParams): Promise<SendResult> {
    const channel = this.channels.find(ch => ch.id === channelId)
    if (!channel) {
      return { success: false, channelId, error: `Channel "${channelId}" not registered` }
    }

    try {
      return await channel.send(params)
    } catch (e) {
      return {
        success: false,
        channelId,
        error: e instanceof Error ? e.message : 'Unknown error',
      }
    }
  }
}

/**
 * Factory: creates a dispatcher with all known channels registered.
 * Channels that aren't configured will report isAvailable=false.
 */
export function createDispatcher(): NotificationDispatcher {
  const dispatcher = new NotificationDispatcher()
  dispatcher.register(new WhatsAppChannel())
  dispatcher.register(new TelegramChannel())
  dispatcher.register(new EmailChannel())
  return dispatcher
}
