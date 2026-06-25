import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function getAuditLog() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('superadmin_audit_log')
    .select('id, accion, recurso_tipo, recurso_id, metadata, ip, created_at, superadmins(nombre, email)')
    .order('created_at', { ascending: false })
    .limit(200)
  return data ?? []
}

const ACCION_COLORS: Record<string, string> = {
  bulk_agregar_creditos: 'text-green-400',
  bulk_cambiar_plan:     'text-indigo-400',
  bulk_suspender:        'text-red-400',
  bulk_activar:          'text-green-400',
  cambiar_plan:          'text-indigo-400',
  agregar_creditos:      'text-green-400',
  guardar_config:        'text-yellow-400',
}

export default async function SeguridadPage() {
  const logs = await getAuditLog()

  const porActor: Record<string, number> = {}
  for (const l of logs) {
    const sa = (l.superadmins as any)
    const nombre = sa?.nombre ?? 'desconocido'
    porActor[nombre] = (porActor[nombre] ?? 0) + 1
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Seguridad & Auditoría</h1>
        <p className="text-gray-400 text-sm mt-1">Registro de todas las acciones sensibles de superadmins</p>
      </div>

      {/* Resumen por actor */}
      {Object.keys(porActor).length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          {Object.entries(porActor).map(([nombre, count]) => (
            <div key={nombre} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">{nombre}</p>
              <p className="text-xl font-bold text-white">{count} <span className="text-xs font-normal text-gray-500">acciones</span></p>
            </div>
          ))}
        </div>
      )}

      {/* Log */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Admin</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Acción</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Recurso</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Metadata</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">Sin registros aún</td>
              </tr>
            )}
            {logs.map(log => {
              const sa = (log.superadmins as any)
              return (
                <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-300">{sa?.nombre ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-mono text-xs ${ACCION_COLORS[log.accion] ?? 'text-gray-300'}`}>
                      {log.accion}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {log.recurso_tipo && <span className="text-gray-600">{log.recurso_tipo}</span>}
                    {log.recurso_id && (
                      <span className="font-mono ml-1 text-gray-600 text-xs">
                        {log.recurso_id.length > 36 ? log.recurso_id.slice(0, 12) + '...' : log.recurso_id}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate">
                    {log.metadata && Object.keys(log.metadata).length > 0
                      ? JSON.stringify(log.metadata).slice(0, 60)
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{log.ip ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
