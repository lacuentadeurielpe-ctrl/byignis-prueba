// GET /api/superadmin/auth-check
// Verifica si el token Bearer del request pertenece a un superadmin.
// Diseñado para llamarse inmediatamente después de signInWithPassword()
// en el login page, donde el token se pasa explícitamente en Authorization.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/^bearer\s+/i, '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Validar el JWT directamente con el service role
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Verificar que sea superadmin activo
  const { data: sa } = await admin
    .from('superadmins')
    .select('id, nombre, nivel, activo')
    .eq('user_id', user.id)
    .eq('activo', true)
    .single()

  if (!sa) {
    return NextResponse.json({ error: 'Esta cuenta no tiene acceso al panel de superadmin' }, { status: 403 })
  }

  return NextResponse.json({ ok: true, nombre: sa.nombre, nivel: sa.nivel })
}
