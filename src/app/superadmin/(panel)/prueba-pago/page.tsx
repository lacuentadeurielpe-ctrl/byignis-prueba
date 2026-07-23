// Banco de pruebas de pago del superadmin (cobro único real de S/2).
// El layout del panel ya garantiza sesión de superadmin.

import PruebaPagoForm from './PruebaPagoForm'

export const dynamic = 'force-dynamic'

export default function PruebaPagoPage() {
  const mpPublicKey =
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? process.env.MP_PUBLIC_KEY ?? ''

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Prueba de pago</h1>
        <p className="text-sm text-gray-400 mt-1">
          Cobra un pago único y real de <strong className="text-white">S/ 2</strong> para verificar
          que una tarjeta funciona y saber si es de crédito o débito. No crea suscripción
          ni toca el acceso de ningún negocio.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-6 text-xs text-amber-300">
        ⚠️ Esto cobra S/ 2 <strong>de verdad</strong> a la tarjeta que ingreses. Es solo para tus
        pruebas — no lo compartas con clientes.
      </div>

      <PruebaPagoForm mpPublicKey={mpPublicKey} />
    </div>
  )
}
