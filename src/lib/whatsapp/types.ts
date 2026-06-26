// Interfaz unificada para enviar mensajes de WhatsApp.
// Los drivers de cada proveedor implementan esta interfaz.

export interface WASender {
  provider: 'ycloud' | 'meta'
  ferreteriaId: string
  telefonoFerreteria: string  // E.164 sin + (ej: 51999888777)

  enviarMensaje(params: { to: string; texto: string }): Promise<void>
  enviarImagen(params: { to: string; imageUrl: string; caption?: string }): Promise<void>
  enviarDocumento(params: { to: string; pdfUrl: string; filename: string; caption?: string }): Promise<void>
  marcarLeido?(messageId: string): Promise<void>
  enviarEscribiendo?(to: string): Promise<void>
}
