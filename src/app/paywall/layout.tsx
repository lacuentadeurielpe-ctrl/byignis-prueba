import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'

export default async function PaywallLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionInfo()

  // Si no está logueado, se va al login
  if (!session) redirect('/auth/login')

  // Si su suscripción ya está activa, no tiene nada que hacer en el paywall
  if (session.estadoSuscripcion === 'activo') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
