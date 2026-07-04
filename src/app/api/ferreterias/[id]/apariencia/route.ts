import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionInfo()
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    
    const { id } = await params

    if (session.ferreteriaId !== id && session.role !== 'SUPERADMIN') {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const body = await request.json()

    // Validate fields to update
    const allowedFields = [
      'logo_url',
      'color_comprobante',
      'pdf_color_secundario',
      'pdf_formato_boleta',
      'pdf_formato_factura',
      'pdf_formato_nota_venta'
    ]

    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return new NextResponse('No fields to update', { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('ferreterias')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Error updating ferreteria apariencia', error)
      return new NextResponse(error.message, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in ferreteria apariencia PATCH', err)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
