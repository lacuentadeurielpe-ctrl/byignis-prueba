/**
 * Tipos para el módulo de entregas/delivery
 */

export type EstadoEntrega = 'asignado' | 'en_camino' | 'entregado' | 'rechazado' | 'devuelto' | 'cancelado'

export interface Entrega {
  id: string
  ferreteria_id: string
  pedido_id: string
  zona_delivery_id: string
  repartidor_id?: string
  vehiculo_id?: string
  estado: EstadoEntrega
  asignado_at: string
  salio_at?: string
  llego_at?: string
  direccion_entrega: string
  instrucciones?: string
  gps_ultima_lat?: number
  gps_ultima_lng?: number
  gps_actualizado_at?: string
  distancia_km?: number
  duracion_estimada_min?: number
  duracion_real_min?: number
  /** Hora de finalización declarada por el repartidor (migración 070) */
  hora_fin_declarada?: string | null
  comprobante_fotos?: string[]
  firma_cliente_url?: string
  nota_entrega?: string
  created_at: string
  updated_at: string
}

export interface EntregaConDetalles extends Entrega {
  pedidos: {
    id: string
    numero_pedido: string
    nombre_cliente: string
    telefono_cliente: string
    total: number
    estado: string
  }
  zonas_delivery: {
    id: string
    nombre: string
    tiempo_estimado_min?: number
  }
  repartidores?: {
    id: string
    nombre: string
    telefono: string
  }
  vehiculos_delivery?: {
    id: string
    tipo: string
    placa: string
  }
}

export interface VehiculoDelivery {
  id: string
  ferreteria_id: string
  tipo: string
  placa: string
  repartidor_id?: string
  activo: boolean
  created_at: string
}

export interface EstadisticasPorZona {
  zona_id: string
  zona_nombre: string
  total: number
  asignado: number
  en_camino: number
  entregado: number
  cancelado: number
}

export interface AsignarEntregaRequest {
  repartidor_id: string
  vehiculo_id?: string
}

export interface CompletarEntregaRequest {
  nota?: string
  firma_url?: string
  fotos?: string[]
}
