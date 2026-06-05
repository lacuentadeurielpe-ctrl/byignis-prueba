/**
 * Valida y limpia el RUC del proveedor, descartándolo si coincide con el del comprador (ferretería).
 */
export function filtrarRucProveedor(
  rucExtraido: string | null,
  rucComprador: string | null
): { ruc: string | null; advertencia?: string } {
  if (!rucExtraido) {
    return { ruc: null }
  }

  const rucLimpio = rucExtraido.replace(/\D/g, '')

  if (rucComprador && rucLimpio === rucComprador.replace(/\D/g, '')) {
    return {
      ruc: null,
      advertencia: 'Se detectó que el RUC extraído del comprobante corresponde a tu propia ferretería (comprador), por lo que fue descartado para evitar confusiones.'
    }
  }

  if (rucLimpio.length > 0 && rucLimpio.length !== 11) {
    return {
      ruc: rucLimpio,
      advertencia: 'El RUC extraído del proveedor no contiene exactamente 11 dígitos.'
    }
  }

  return { ruc: rucLimpio || null }
}
