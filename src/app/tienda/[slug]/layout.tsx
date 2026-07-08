import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  
  // Note: we can't use absolute URL in fetch here easily without knowing host in some envs
  // But we can query Supabase directly for metadata
  // To keep it simple, we will set a generic title for now or try to fetch it if possible.
  
  return {
    title: `Catálogo - ${slug}`,
    description: 'Catálogo de productos en línea',
  }
}

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-indigo-100">
      {children}
    </div>
  )
}
