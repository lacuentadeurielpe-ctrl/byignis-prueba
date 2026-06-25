import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { inicioDiaLima } from '@/lib/tiempo'
import TenantActions from './TenantActions'

export const dynamic = 'force-dynamic'

async function getTenantDetail(id: string) {
  const admin   = createAdminClient()
  const hace30d = inicioDiaLima(-30)

  const [
    { data: ferreteria },
    { data: suscripcion },
    { data: ycloudConfig },
    { data: incidencias },
    { data: movimientos30d },
    { data: recargas },
    { data: auditLog },
    { data: todoElConsumo },
    { data: planes },
  ] = await Promise.all([
    admin.from('ferreterias')
      .select('id, nombre, telefono_whatsapp, activo, estado_tenant, trial_hasta, suspendido_motivo, suspendido_at, created_at, notas_internas, plan_id, planes(id, nombre, creditos_mes, precio_mensual)')
      .eq('id', id).single(),

    admin.from('suscripciones')
      .select('creditos_disponibles, creditos_del_mes, creditos_extra, creditos_mes, estado, ciclo_inicio, ciclo_fin, plan_id')
      .eq('ferreteria_id', id).single(),

    admin.from('configuracion_ycloud')
      .select('numero_whatsapp, estado_conexion, ultimo_mensaje_at, ultimo_error, ultimo_error_at')
      .eq('ferreteria_id', id).single(),

    admin.from('incidencias_sistema')
      .select('id, tipo, detalle, resuelto, created_at')
      .eq('ferreteria_id', id)
      .order('created_at', { ascending: false })
      .limit(10),

    admin.from('movimientos_creditos')
      .select('tipo_tarea, modelo_usado, creditos_usados, costo_usd, created_at')
      .eq('ferreteria_id', id)
      .gte('created_at', hace30d)
      .order('created_at', { ascending: false })
      .limit(50),

    admin.from('recargas_creditos')
      .select('creditos, motivo, monto_cobrado, created_at')
      .eq('ferreteria_id', id)
      .order('created_at', { ascending: false })
      .limit(20),

    admin.from('superadmin_audit_log')
      .select('accion, recurso_tipo, metadata, created_at, superadmins(nombre)')
      .eq('recurso_id', id)
      .order('created_at', { ascending: false })
      .limit(20),

    admin.from('movimientos_creditos')
      .select('creditos_usados, costo_usd')
      .eq('ferreteria_id', id),

    admin.from('planes').select('id, nombre'),
  ])

  if (!ferreteria) return null

  const totalConsumo = (todoElConsumo ?? []).reduce(
    (acc, m) => ({ creditos: acc.creditos + (m.creditos_usados ?? 0), usd: acc.usd + Number(m.costo_usd ?? 0) }),
    { creditos: 0, usd: 0 }
  )

  const consumo30d = (movimientos30d ?? []).reduce(
    (acc, m) => ({ creditos: acc.creditos + (m.creditos_usados ?? 0), usd: acc.usd + Number(m.costo_usd ?? 0) }),
    { creditos: 0, usd: 0 }
  )

  return { ferreteria, suscripcion, ycloudConfig, incidencias, movimientos30d, recargas, auditLog, totalConsumo, consumo30d, planes: planes ?? [] }
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getTenantDetail(id)
  if (!data) notFound()

  const { ferreteria, suscripcion, ycloudConfig, incidencias, movimientos30d, recargas, auditLog, totalConsumo, consumo30d, planes } = data
  const f    = ferreteria as any
  const plan = f.planes

  const YCLOUD_COLORS: Record<string, string> = {
    activo:       'text-green-400',
    error:        'text-red-400',
    desconectado: 'text-gray-400',
    pendiente:    'text-yellow-400',
  }

  const creditosDisp  = suscripcion?.creditos_disponibles ?? 0
  const creditosExtra = suscripcion?.creditos_extra ?? 0
  const creditosMes   = suscripcion?.creditos_mes ?? plan?.creditos_mes ?? 0
  const creditosPct   = creditosMes > 0 ? Math.round((creditosDisp / creditosMes) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <a href="/superadmin/tenants" className="text-gray-500 hover:text-white text-sm">← Tenants</a>
          </div>
          <h1 className="text-2xl font-bold">{ferreteria.nombre}</h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">{ferreteria.telefono_whatsapp}</p>
          {f.notas_internas && (
            <p className="mt-2 text-xs text-yellow-400 bg-yellow-950/30 border border-yellow-800 rounded-lg px-3 py-1.5 max-w-sm">
              {f.notas_internas}
            </p>
          )}
        </div>
        <TenantActions
          tenantId={id}
          estadoActual={ferreteria.estado_tenant ?? 'trial'}
          nombre={ferreteria.nombre}
          ycloudConfigurado={!!ycloudConfig}
          creditosDisponibles={creditosDisp}
          planActualId={f.plan_id ?? suscripcion?.plan_id ?? null}
          planes={planes}
          notasIniciales={f.notas_internas ?? ''}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Créditos disponibles</p>
          <p className={`text-2xl font-bold ${creditosDisp === 0 ? 'text-red-400' : creditosPct < 20 ? 'text-yellow-400' : 'text-white'}`}>
            {creditosDisp.toLocaleString()}
          </p>
          <div className="mt-2 w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${creditosPct < 20 ? 'bg-red-500' : creditosPct < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(creditosPct, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-600 mt-1">{creditosPct}% de {creditosMes.toLocaleString()} plan</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Consumo últimos 30d</p>
          <p className="text-2xl font-bold text-indigo-400">{consumo30d.creditos.toLocaleString()}</p>
          <p className="text-xs text-gray-600 mt-1">${consumo30d.usd.toFixed(4)} USD costo IA</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total consumido</p>
          <p className="text-2xl font-bold text-gray-300">{totalConsumo.creditos.toLocaleString()}</p>
          <p className="text-xs text-gray-600 mt-1">créditos histórico</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Costo IA total</p>
          <p className="text-2xl font-bold text-gray-300">${totalConsumo.usd.toFixed(3)}</p>
          <p className="text-xs text-gray-600 mt-1">USD histórico</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Suscripción */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Suscripción</h3>
          {suscripcion ? (
            <div className="space-y-2 text-sm">
              <Row label="Plan" value={plan?.nombre ?? 'Sin plan'} />
              <Row label="Estado" value={suscripcion.estado ?? '—'} />
              <Row label="Créditos disponibles" value={creditosDisp.toLocaleString()} highlight />
              <Row label="Créditos del mes" value={(suscripcion.creditos_del_mes ?? 0).toLocaleString()} />
              <Row label="Créditos extra (manual)" value={creditosExtra.toLocaleString()} />
              {suscripcion.ciclo_fin && (
                <Row label="Ciclo termina" value={new Date(suscripcion.ciclo_fin).toLocaleDateString('es-PE')} />
              )}
            </div>
          ) : (
            <div>
              <p className="text-gray-500 text-sm">Sin suscripción aún</p>
              <p className="text-xs text-gray-600">Al agregar créditos se crea automáticamente</p>
            </div>
          )}
        </div>

        {/* YCloud */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Configuración YCloud</h3>
          {ycloudConfig ? (
            <div className="space-y-2 text-sm">
              <Row label="Número" value={ycloudConfig.numero_whatsapp ?? '—'} />
              <div className="flex justify-between">
                <span className="text-gray-500">Estado</span>
                <span className={YCLOUD_COLORS[ycloudConfig.estado_conexion ?? 'pendiente'] ?? 'text-white'}>
                  {ycloudConfig.estado_conexion ?? '—'}
                </span>
              </div>
              {ycloudConfig.ultimo_mensaje_at && (
                <Row label="Último mensaje" value={new Date(ycloudConfig.ultimo_mensaje_at).toLocaleString('es-PE')} />
              )}
              {ycloudConfig.ultimo_error && (
                <div>
                  <span className="text-gray-500 text-xs">Último error:</span>
                  <p className="text-red-400 text-xs mt-1 font-mono">{ycloudConfig.ultimo_error.slice(0, 100)}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No configurado</p>
          )}
        </div>
      </div>

      {/* Incidencias */}
      {incidencias && incidencias.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Últimas incidencias</h3>
          <div className="space-y-2">
            {incidencias.map(inc => (
              <div key={inc.id} className="flex items-start gap-3 text-sm">
                <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${inc.resuelto ? 'bg-gray-600' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <span className={`font-mono text-xs ${inc.resuelto ? 'text-gray-500' : 'text-red-300'}`}>{inc.tipo}</span>
                  {inc.detalle && <p className="text-gray-500 text-xs truncate">{inc.detalle}</p>}
                </div>
                <span className="text-gray-600 text-xs shrink-0">
                  {new Date(inc.created_at).toLocaleDateString('es-PE')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consumo 30d + recargas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Historial de recargas */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Historial de recargas</h3>
          {recargas && recargas.length > 0 ? (
            <div className="space-y-2">
              {recargas.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-green-400 font-bold">+{r.creditos.toLocaleString()} cr</span>
                    <span className="text-gray-500 ml-2">{r.motivo}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {Number(r.monto_cobrado) > 0 && (
                      <span className="text-gray-400">S/ {Number(r.monto_cobrado).toFixed(2)}</span>
                    )}
                    <span className="text-gray-600">
                      {new Date(r.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Sin recargas</p>
          )}
        </div>

        {/* Consumo IA 30 días */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">Consumo IA (últimos 30d)</h3>
            <span className="text-xs text-gray-600">{movimientos30d?.length ?? 0} registros</span>
          </div>
          {movimientos30d && movimientos30d.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-2">Tarea</th>
                  <th className="pb-2 text-right">Cr</th>
                  <th className="pb-2 text-right">USD</th>
                  <th className="pb-2 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {movimientos30d.map((m, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-gray-300 font-mono text-xs">{m.tipo_tarea}</td>
                    <td className="py-1.5 text-right text-indigo-300">{m.creditos_usados}</td>
                    <td className="py-1.5 text-right text-gray-500">{m.costo_usd ? `$${Number(m.costo_usd).toFixed(4)}` : '—'}</td>
                    <td className="py-1.5 text-right text-gray-600">
                      {new Date(m.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-sm">Sin movimientos en 30 días</p>
          )}
        </div>
      </div>

      {/* Log de auditoría para este tenant */}
      {auditLog && auditLog.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Acciones de superadmin</h3>
          <div className="space-y-2">
            {auditLog.map((entry: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-indigo-400 font-mono shrink-0">{entry.accion}</span>
                <div className="flex-1 min-w-0">
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <span className="text-gray-600 truncate block">
                      {JSON.stringify(entry.metadata).slice(0, 80)}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {entry.superadmins && (
                    <span className="text-gray-500">{(entry.superadmins as any).nombre} · </span>
                  )}
                  <span className="text-gray-600">
                    {new Date(entry.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={highlight ? 'font-bold text-indigo-400' : 'text-white'}>{value}</span>
    </div>
  )
}
