// Conversión de certificado digital PFX/P12 → PEM para Lycet.
//
// Lycet (motor SUNAT) consume el certificado en formato PEM (certificado público
// + clave privada concatenados). El negocio sube un .pfx/.p12; aquí lo convertimos
// en Node con `node-forge` (JS puro), evitando el gotcha de OpenSSL 3.x legacy
// provider (RC2/3DES) que traen los certificados SUNAT/RENIEC dentro de contenedores.
//
// También extraemos la fecha de vencimiento para avisar al negocio antes de que expire.

import forge from 'node-forge'

export interface CertificadoConvertido {
  pem:     string   // certificado + clave privada en PEM (lo que Lycet necesita)
  venceAt: Date     // vencimiento del certificado (notAfter)
  emiteA:  string   // CN del sujeto (para mostrar de qué certificado se trata)
}

/**
 * Convierte un PFX/P12 (base64) + su clave a PEM y extrae metadatos.
 * Lanza Error con mensaje claro si la clave es incorrecta o el archivo es inválido.
 */
export function pfxAPem(pfxBase64: string, clave: string): CertificadoConvertido {
  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    const der  = forge.util.decode64(pfxBase64)
    const asn1 = forge.asn1.fromDer(der)
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, clave)
  } catch {
    throw new Error('No se pudo leer el certificado: la contraseña es incorrecta o el archivo .pfx no es válido.')
  }

  // Certificado público
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]
  const certBag  = certBags?.[0]
  if (!certBag?.cert) {
    throw new Error('El certificado no contiene un certificado público válido.')
  }
  const cert = certBag.cert

  // Clave privada (puede venir cifrada — pkcs8ShroudedKeyBag — o en claro — keyBag)
  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
  const plain    = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]
  const keyBag   = shrouded?.[0] ?? plain?.[0]
  if (!keyBag?.key) {
    throw new Error('El certificado no contiene una clave privada. Verifica que exportaste el .pfx con la clave privada incluida.')
  }

  const certPem = forge.pki.certificateToPem(cert)
  const keyPem  = forge.pki.privateKeyToPem(keyBag.key)

  const cn = cert.subject.getField('CN')?.value ?? ''

  return {
    pem:     certPem + keyPem,
    venceAt: cert.validity.notAfter,
    emiteA:  cn,
  }
}
