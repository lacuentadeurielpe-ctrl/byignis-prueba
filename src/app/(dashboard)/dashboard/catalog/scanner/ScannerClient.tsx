'use client'

import { useRouter } from 'next/navigation'
import SmartPurchaseCapture from '@/components/contabilidad/SmartPurchaseCapture'

export default function ScannerClient() {
  const router = useRouter()

  return (
    <SmartPurchaseCapture 
      onClose={() => router.push('/dashboard/catalog')} 
    />
  )
}
