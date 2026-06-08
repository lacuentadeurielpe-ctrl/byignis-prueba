import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// GET /api/clientes — listar clientes con filtros avanzados
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const url = new URL(request.url)

  // Parámetros de búsqueda y filtros
  const search = url.searchParams.get('search') || ''
  const tipo = url.searchParams.get('tipo')
  const tags = url.searchParams.get('tags')
  const desdeGasto = url.searchParams.get('desdeGasto')
  const hastaGasto = url.searchParams.get('hastaGasto')
  const desdeRecha = url.searchParams.get('desdeRecha')
  const hastaFecha = url.searchParams.get('hastaFecha')
  const conDeuda = url.searchParams.get('conDeuda')
  const sort = url.searchParams.get('sort') || 'created_at'
  const order = url.searchParams.get('order') || 'desc'
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  try {
    // Consulta base con relacionadas
    let query = supabase
      .from('clientes')
      .select(`
        id, ferreteria_id, nombre, telefono, dni_ruc, tipo, alias,
        email, telefono_secundario, direccion_habitual, tags, notas_internas, created_at, updated_at,
        pedidos(id, total, estado, created_at),
        creditos(id, monto_total, monto_pagado, estado)
      `)
      .eq('ferreteria_id', session.ferreteriaId)

    // Filtro por tipo de cliente
    if (tipo) {
      query = query.eq('tipo', tipo)
    }

    // Filtro por rango de fechas
    if (desdeRecha) {
      query = query.gte('created_at', desdeRecha)
    }
    if (hastaFecha) {
      query = query.lte('created_at', hastaFecha)
    }

    // Filtro de búsqueda por nombre, teléfono, DNI/RUC, alias
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,telefono.ilike.%${search}%,dni_ruc.ilike.%${search}%,alias.ilike.%${search}%`)
    }

    // Ejecutar consulta
    const { data, error, count } = await query
      .order(sort === 'nombre' ? 'nombre' : 'created_at', { ascending: order === 'asc' })
      .range((page - 1) * limit, page * limit - 1)

    if (error) {
      console.error('Error fetching clientes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Procesar datos y calcular métricas
    const clientesConMetricas = (data ?? []).map((c) => {
      const pedidos = (c.pedidos ?? []) as Array<{ id: string; total: number; estado: string; created_at: string }>
      const pedidosCompletados = pedidos.filter(p => p.estado !== 'cancelado')
      const totalGastado = pedidosCompletados.reduce((s, p) => s + (p.total ?? 0), 0)
      const ultimoPedido = pedidos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      const creditos = (c.creditos ?? []) as Array<{ monto_total: number; monto_pagado: number; estado: string }>
      const deuda = creditos.reduce((s, cr) => s + (cr.monto_total - cr.monto_pagado), 0)

      return {
        id: c.id,
        nombre: c.nombre ?? null,
        telefono: c.telefono ?? null,
        dni_ruc: c.dni_ruc ?? null,
        tipo: c.tipo ?? 'persona',
        alias: c.alias ?? null,
        email: c.email ?? null,
        telefono_secundario: c.telefono_secundario ?? null,
        direccion_habitual: c.direccion_habitual ?? null,
        tags: c.tags ?? [],
        notas_internas: c.notas_internas ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at,
        totalGastado,
        deuda,
        ultimoPedido: ultimoPedido?.created_at ?? null,
        totalPedidos: pedidos.length,
      }
    })

    // Aplicar filtros locales (gasto, deuda)
    let filtered = clientesConMetricas

    if (desdeGasto || hastaGasto) {
      const desde = desdeGasto ? parseFloat(desdeGasto) : 0
      const hasta = hastaGasto ? parseFloat(hastaGasto) : Infinity
      filtered = filtered.filter(c => c.totalGastado >= desde && c.totalGastado <= hasta)
    }

    if (conDeuda !== null && conDeuda !== undefined) {
      const tieneDeuda = conDeuda === 'true'
      filtered = filtered.filter(c => tieneDeuda ? c.deuda > 0 : c.deuda === 0)
    }

    const total = filtered.length
    const pages = Math.ceil(total / limit)
    const paginado = filtered.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      data: paginado,
      total,
      page,
      limit,
      pages,
    })
  } catch (err) {
    console.error('Error in GET /api/clientes:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/clientes — crear nuevo cliente
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    const body = await request.json()
    const { nombre, telefono, dni_ruc, tipo = 'persona', email, telefono_secundario, direccion_habitual, tags = [], alias } = body

    // Validaciones
    if (!telefono && !dni_ruc) {
      return NextResponse.json(
        { error: 'Se requiere al menos teléfono o DNI/RUC' },
        { status: 400 }
      )
    }

    // Validar tipo de cliente
    const TIPOS_VALIDOS = ['persona', 'empresa', 'anonimo']
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de cliente inválido' }, { status: 400 })
    }

    // Validar DNI/RUC si se proporciona
    if (dni_ruc) {
      const limpio = dni_ruc.replace(/\D/g, '')
      if (limpio.length !== 8 && limpio.length !== 11) {
        return NextResponse.json(
          { error: 'DNI debe tener 8 dígitos o RUC 11 dígitos' },
          { status: 400 }
        )
      }
    }

    // Validar unicidad de teléfono (si se proporciona)
    if (telefono) {
      const { data: existing } = await supabase
        .from('clientes')
        .select('id')
        .eq('ferreteria_id', session.ferreteriaId)
        .eq('telefono', telefono)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un cliente con este teléfono' },
          { status: 409 }
        )
      }
    }

    // Validar unicidad de DNI/RUC (si se proporciona)
    if (dni_ruc) {
      const dniLimpio = dni_ruc.replace(/\D/g, '')
      const { data: existing } = await supabase
        .from('clientes')
        .select('id')
        .eq('ferreteria_id', session.ferreteriaId)
        .eq('dni_ruc', dniLimpio)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un cliente con este DNI/RUC' },
          { status: 409 }
        )
      }
    }

    // Crear cliente
    const nuevoCliente = {
      ferreteria_id: session.ferreteriaId,
      nombre: nombre?.trim() || null,
      telefono: telefono?.trim() || null,
      dni_ruc: dni_ruc ? dni_ruc.replace(/\D/g, '') : null,
      tipo,
      alias: alias?.trim() || null,
      email: email?.trim() || null,
      telefono_secundario: telefono_secundario?.trim() || null,
      direccion_habitual: direccion_habitual?.trim() || null,
      tags: Array.isArray(tags) ? tags : [],
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert([nuevoCliente])
      .select('id, ferreteria_id, nombre, telefono, dni_ruc, tipo, alias, email, telefono_secundario, direccion_habitual, tags, created_at')
      .single()

    if (error) {
      console.error('Error creating cliente:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/clientes:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
