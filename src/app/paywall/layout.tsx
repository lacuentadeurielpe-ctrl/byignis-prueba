import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'

export default async function PaywallLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionInfo()

  // Ver comentario equivalente en (dashboard)/layout.tsx: el proxy ya
  // garantiza sesión válida acá — null significa onboarding incompleto.
  if (!session) redirect('/onboarding')

  // Si su suscripción ya está activa, no tiene nada que hacer en el paywall
  if (session.estadoSuscripcion === 'activo') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
