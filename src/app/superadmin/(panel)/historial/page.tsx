import { createAdminClient } from '@/lib/supabase/admin'
import HistorialClient from './HistorialClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createAdminClient()

  const [{ data: ferreterias }, { data: suscripciones }] = await Promise.all([
    admin.from('ferreterias').select('id, nombre, estado_tenant, created_at').order('created_at', { ascending: false }),
    admin.from('suscripciones').select('ferreteria_id, estado, ciclo_inicio, ciclo_fin'),
  ])

  const suscMap = Object.fromEntries((suscripciones ?? []).map(s => [s.ferreteria_id, s]))

  const historial = (ferreterias ?? []).map(f => {
    const sus = suscMap[f.id]
    
    // Calcular "cuanto tiempo" basado en created_at y el estado actual
    const fechaInicio = sus?.ciclo_inicio || f.created_at
    const fechaFin = sus?.ciclo_fin
    
    return {
      id: f.id,
      nombre: f.nombre,
      estado_actual: sus?.estado || 'desconocido',
      fecha_registro: f.created_at,
      fecha_inicio: fechaInicio,
      fecha_salida: (sus?.estado === 'suspendido' || sus?.estado === 'vencido') ? (fechaFin || new Date().toISOString()) : null,
    }
  })

  return { historial }
}

export default async function HistorialPage() {
  const { historial } = await getData()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Historial de Suscripciones</h1>
          <p className="text-gray-400 text-sm mt-1">Registro de actividad y tiempo de retención de clientes</p>
        </div>
      </div>
      <HistorialClient historial={historial} />
    </div>
  )
}
