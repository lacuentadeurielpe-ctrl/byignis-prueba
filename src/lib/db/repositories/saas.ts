import type { SupabaseClient } from '@supabase/supabase-js'

export class SaasRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Obtiene la ficha de datos de la ferretería (RUC, nombre, ubicación, teléfonos).
   */
  async obtenerFerreteria(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('ferreterias')
      .select('*')
      .eq('id', ferreteriaId)
      .single()

    if (error) throw new Error(`Error al obtener ferretería: ${error.message}`)
    return data
  }

  /**
   * Obtiene la configuración de integraciones de la cuenta de WhatsApp (YCloud).
   */
  async obtenerConfiguracionYCloud(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('configuracion_ycloud')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()

    if (error) throw new Error(`Error al obtener configuración YCloud: ${error.message}`)
    return data
  }

  /**
   * Actualiza el registro de errores o alertas técnicas del canal YCloud del local.
   */
  async registrarErrorYCloud(ferreteriaId: string, errorMsg: string) {
    await this.supabase
      .from('configuracion_ycloud')
      .update({
        ultimo_error_at: new Date().toISOString(),
        ultimo_error:    errorMsg,
      })
      .eq('ferreteria_id', ferreteriaId)
  }

  /**
   * Obtiene los permisos y rol del miembro en el local.
   */
  async obtenerMiembro(userId: string) {
    const { data } = await this.supabase
      .from('miembros_ferreteria')
      .select('ferreteria_id, rol, nombre, permisos, ferreterias(id, nombre, onboarding_completo)')
      .eq('user_id', userId)
      .eq('activo', true)
      .maybeSingle()

    return data
  }

  /**
   * Busca la ferretería asociada de la cual el usuario es dueño directo.
   */
  async obtenerFerreteriaPorDuenio(ownerId: string) {
    const { data } = await this.supabase
      .from('ferreterias')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle()

    return data
  }

  /**
   * Obtiene la configuración del bot (perfil, márgenes, debounces) de la ferretería.
   */
  async obtenerConfiguracionBot(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('configuracion_bot')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  /**
   * Obtiene la información de una invitación de equipo por su token.
   */
  async obtenerInvitacionPorToken(token: string) {
    const { data, error } = await this.supabase
      .from('invitaciones')
      .select('id, usada, expires_at, ferreterias(nombre)')
      .eq('token', token)
      .single()

    if (error) return null
    return data
  }

  async crearFerreteria(params: {
    owner_id: string
    nombre: string
    direccion: string | null
    telefono_whatsapp: string
    horario_apertura: string
    horario_cierre: string
    dias_atencion: string[]
    formas_pago: string[]
    mensaje_bienvenida: string | null
    mensaje_fuera_horario: string | null
    onboarding_completo: boolean
    tipo_ruc: string
    ruc: string | null
    razon_social: string | null
    regimen_tributario: string | null
    representante_legal_nombre: string | null
    representante_legal_dni: string | null
  }) {
    const { data, error } = await this.supabase
      .from('ferreterias')
      .insert(params)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async actualizarFerreteria(ownerId: string, fields: any) {
    const { data, error } = await this.supabase
      .from('ferreterias')
      .update(fields)
      .eq('owner_id', ownerId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async actualizarConfiguracionBot(ferreteriaId: string, fields: any) {
    const { data, error } = await this.supabase
      .from('configuracion_bot')
      .update(fields)
      .eq('ferreteria_id', ferreteriaId)
      .select()
      .maybeSingle()

    if (error) throw error
    return data
  }

  async listarMiembros(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('miembros_ferreteria')
      .select('id, nombre, email, rol, activo, created_at')
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async actualizarMiembroActivo(ferreteriaId: string, miembroId: string, activo: boolean) {
    const { data, error } = await this.supabase
      .from('miembros_ferreteria')
      .update({ activo })
      .eq('id', miembroId)
      .eq('ferreteria_id', ferreteriaId)
      .select('id, nombre, activo')
      .single()

    if (error) throw error
    return data
  }

  async invalidarInvitacionesPendientes(ferreteriaId: string) {
    const { error } = await this.supabase
      .from('invitaciones')
      .update({ usada: true })
      .eq('ferreteria_id', ferreteriaId)
      .eq('usada', false)

    if (error) throw error
  }

  async crearInvitacion(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('invitaciones')
      .insert({ ferreteria_id: ferreteriaId })
      .select('token, expires_at')
      .single()

    if (error) throw error
    return data
  }
}
