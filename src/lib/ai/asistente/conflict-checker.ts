import type { AsistenteConfigSnapshot } from './context-builder'

/**
 * Detecta conflictos antes de ejecutar una tool.
 * Retorna descripción del conflicto (string) o null si no hay problema.
 */
export function checkConflict(
  toolName: string,
  args: Record<string, unknown>,
  snapshot: AsistenteConfigSnapshot
): string | null {

  // ── toggle_agente desactivando ──────────────────────────────────────────────
  if (toolName === 'toggle_agente' && args.activo === false) {
    const id = String(args.agente_id ?? '')

    if (id === 'pagos' && snapshot.config_recordatorios_deuda.activo) {
      return `El agente "pagos" tiene recordatorios automáticos de deuda ACTIVOS. Al desactivarlo, el bot no podrá gestionar créditos en WhatsApp, pero el cron seguirá enviando mensajes diarios. ¿Quieres también desactivar los recordatorios? Confirma si igualmente deseas desactivar el agente.`
    }

    if (id === 'ventas') {
      return `"ventas" es el agente principal — sin él el bot no puede crear pedidos ni cotizaciones. ¿Confirmas desactivarlo?`
    }

    const instruccion = snapshot.instrucciones_agentes[id]
    if (instruccion?.trim()) {
      return `El agente "${id}" tiene una instrucción personalizada configurada. Al desactivarlo, la instrucción se conserva pero no tendrá efecto. ¿Continuar?`
    }
  }

  // ── toggle_tool desactivando ────────────────────────────────────────────────
  if (toolName === 'toggle_tool' && args.activo === false) {
    const tn = String(args.tool_name ?? '')
    const CORE = new Set(['buscar_producto', 'obtener_stock', 'consultar_pedido', 'info_ferreteria', 'escalar_humano'])

    if (CORE.has(tn)) {
      return `"${tn}" es una herramienta núcleo crítica. Desactivarla puede romper el flujo básico del bot. ¿Confirmas?`
    }

    if (tn === 'consultar_credito_formal') {
      return `Si desactivas "consultar_credito_formal", el flujo de "registrar_abono_credito" pierde contexto (no podrá ver el crédito antes de registrar el abono). ¿Confirmas?`
    }

    const nota = snapshot.instrucciones_tools[tn]
    if (nota?.trim()) {
      return `La herramienta "${tn}" tiene una nota de comportamiento configurada. Al desactivarla, la nota se conserva pero no tendrá efecto. ¿Continuar?`
    }
  }

  // ── instrucción de agente muy corta ────────────────────────────────────────
  if (toolName === 'editar_instruccion_agente') {
    const texto = String(args.texto ?? '')
    if (texto.trim().length > 0 && texto.trim().length < 15) {
      return `La instrucción tiene solo ${texto.trim().length} caracteres, lo que probablemente tenga poco impacto. ¿Quieres ampliarla antes de guardar?`
    }
  }

  return null
}
