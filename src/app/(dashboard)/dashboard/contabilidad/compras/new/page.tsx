import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import CompraForm from '@/components/contabilidad/CompraForm'

export const dynamic = 'force-dynamic'

export default async function NuevaCompraPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')
  if (session.rol !== 'dueno') redirect('/dashboard')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <CompraForm />
    </div>
  )
}
