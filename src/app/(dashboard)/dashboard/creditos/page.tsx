import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Ruta legacy — redirige al tab Deudas dentro de Ventas
export default function CreditosPage() {
  redirect('/dashboard/ventas?tab=deudas')
}
