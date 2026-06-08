export interface Local {
  id: string
  ferreteria_id: string
  nombre: string
  codigo?: string
  descripcion?: string
  direccion: string
  lat?: number
  lng?: number
  place_id?: string
  telefono?: string
  horario_apertura?: string
  horario_cierre?: string
  dias_atencion?: string[]
  es_principal: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

export interface LocalFormData {
  nombre: string
  codigo?: string
  descripcion?: string
  direccion: string
  lat?: number
  lng?: number
  place_id?: string
  telefono?: string
  horario_apertura?: string
  horario_cierre?: string
  dias_atencion?: string[]
  es_principal?: boolean
}

export interface GooglePlacesResult {
  descripcion: string
  place_id: string
  lat: number
  lng: number
}

export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
export const DIAS_SEMANA_LABELS: Record<string, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
  domingo: 'Dom',
}
