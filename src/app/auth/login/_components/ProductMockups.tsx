/**
 * Recreaciones fieles de pantallas reales del producto, para la sección
 * "Todo lo que tu negocio necesita" de la landing.
 *
 * No son screenshots literales (evita exponer datos reales de clientes) ni
 * fotos de stock genéricas — son vistas reconstruidas con la MISMA paleta
 * minimalista clara del dashboard real (blanco/zinc-200, azul-600 como
 * acento, esmeralda para dinero, ámbar para pendientes), enmarcadas como
 * ventana de navegador para leerse bien sobre el fondo oscuro de la landing.
 */

function BrowserFrame({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-300/50 shadow-2xl bg-white">
      <div className="h-7 bg-zinc-50 border-b border-zinc-200 flex items-center gap-1.5 px-3 shrink-0">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <div className="ml-2 flex-1 h-4 bg-white rounded text-[8px] text-zinc-400 flex items-center px-2 border border-zinc-200 truncate">
          uintegrus.com/{path}
        </div>
      </div>
      <div className="bg-white h-[calc(100%-1.75rem)] p-3 overflow-hidden">{children}</div>
    </div>
  )
}

const Badge = ({ color, children }: { color: 'green' | 'amber' | 'blue'; children: React.ReactNode }) => {
  const map = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${map[color]}`}>{children}</span>
}

// 1. Tienda Online Integrada — catálogo público compartible (ej. boutique)
export function MockupTienda() {
  const productos = [
    { nombre: 'Blusa manga larga', precio: 'S/ 45', color: 'bg-rose-100' },
    { nombre: 'Jean clásico', precio: 'S/ 89', color: 'bg-blue-100' },
    { nombre: 'Zapatillas urbanas', precio: 'S/ 120', color: 'bg-amber-100' },
    { nombre: 'Casaca denim', precio: 'S/ 135', color: 'bg-indigo-100' },
  ]
  return (
    <BrowserFrame path="tienda/mi-negocio">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-bold text-zinc-800">Catálogo Online</p>
        <div className="flex items-center gap-1 bg-emerald-500 text-white text-[7px] font-semibold px-2 py-1 rounded-full">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z"/></svg>
          Enviar pedido
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {productos.map((p) => (
          <div key={p.nombre} className="border border-zinc-200 rounded-lg p-1.5">
            <div className={`h-10 rounded ${p.color} mb-1.5`} />
            <p className="text-[8px] font-medium text-zinc-700 truncate">{p.nombre}</p>
            <p className="text-[9px] font-bold text-zinc-900">{p.precio}</p>
          </div>
        ))}
      </div>
    </BrowserFrame>
  )
}

// 2. Facturación Electrónica — comprobantes SUNAT
export function MockupFacturacion() {
  const filas = [
    { doc: 'B001-00458', cliente: 'Carlos M.', total: 'S/ 189.00', estado: 'Aceptado' },
    { doc: 'F001-00112', cliente: 'Distribuidora Lima SAC', total: 'S/ 1,240.00', estado: 'Aceptado' },
    { doc: 'B001-00459', cliente: 'María R.', total: 'S/ 65.00', estado: 'Aceptado' },
  ]
  return (
    <BrowserFrame path="dashboard/comprobantes">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-zinc-800">Comprobantes</p>
        <div className="bg-blue-600 text-white text-[7px] font-semibold px-2 py-1 rounded">+ Nueva boleta</div>
      </div>
      <div className="border border-zinc-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr] bg-zinc-50 px-2 py-1 border-b border-zinc-200">
          {['Doc', 'Cliente', 'Total', 'SUNAT'].map((h) => (
            <p key={h} className="text-[7px] font-semibold text-zinc-400 uppercase">{h}</p>
          ))}
        </div>
        {filas.map((f) => (
          <div key={f.doc} className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr] px-2 py-1.5 border-b border-zinc-100 last:border-0 items-center">
            <p className="text-[8px] text-zinc-700 font-medium truncate">{f.doc}</p>
            <p className="text-[8px] text-zinc-600 truncate">{f.cliente}</p>
            <p className="text-[8px] text-zinc-900 font-semibold">{f.total}</p>
            <Badge color="green">{f.estado}</Badge>
          </div>
        ))}
      </div>
    </BrowserFrame>
  )
}

// 3. Gestión de Inventarios — stock en tiempo real (ej. minimarket)
export function MockupInventario() {
  const items = [
    { nombre: 'Gaseosa 1.5L', stock: 24, pct: 80, color: 'bg-emerald-500' },
    { nombre: 'Arroz 5kg', stock: 6, pct: 20, color: 'bg-amber-500' },
    { nombre: 'Aceite 1L', stock: 18, pct: 60, color: 'bg-emerald-500' },
    { nombre: 'Detergente 900g', stock: 2, pct: 8, color: 'bg-red-500' },
  ]
  return (
    <BrowserFrame path="dashboard/catalog">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-bold text-zinc-800">Inventario</p>
        <Badge color="amber">2 stock bajo</Badge>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.nombre}>
            <div className="flex justify-between mb-0.5">
              <p className="text-[8px] text-zinc-700 truncate">{it.nombre}</p>
              <p className="text-[8px] font-semibold text-zinc-900">{it.stock} und</p>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className={`h-full ${it.color} rounded-full`} style={{ width: `${it.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  )
}

// 4. Múltiples Sucursales — supervisión centralizada
export function MockupSucursales() {
  const locales = [
    { nombre: 'Sucursal Principal', ventas: 'S/ 3,420', pedidos: 18 },
    { nombre: 'Sucursal Norte', ventas: 'S/ 1,180', pedidos: 7 },
  ]
  return (
    <BrowserFrame path="dashboard?sucursal=todas">
      <p className="text-[10px] font-bold text-zinc-800 mb-2.5">Todas las sucursales</p>
      <div className="space-y-2">
        {locales.map((l) => (
          <div key={l.nombre} className="border border-zinc-200 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <p className="text-[8px] font-medium text-zinc-700 truncate">{l.nombre}</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <div className="text-right">
                <p className="text-[9px] font-bold text-zinc-900">{l.ventas}</p>
                <p className="text-[6px] text-zinc-400 uppercase">Ventas hoy</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-blue-600">{l.pedidos}</p>
                <p className="text-[6px] text-zinc-400 uppercase">Pedidos</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  )
}

// 5. Clientes y Empleados — equipo y permisos
export function MockupEquipo() {
  const personas = [
    { nombre: 'Ana Torres', rol: 'Dueña', iniciales: 'AT', color: 'bg-blue-500' },
    { nombre: 'Luis Paredes', rol: 'Vendedor', iniciales: 'LP', color: 'bg-emerald-500' },
    { nombre: 'Rosa Quispe', rol: 'Vendedora', iniciales: 'RQ', color: 'bg-purple-500' },
  ]
  return (
    <BrowserFrame path="dashboard/equipo">
      <p className="text-[10px] font-bold text-zinc-800 mb-2.5">Equipo</p>
      <div className="space-y-1.5">
        {personas.map((p) => (
          <div key={p.nombre} className="flex items-center gap-2 border border-zinc-200 rounded-lg px-2 py-1.5">
            <div className={`w-5 h-5 rounded-full ${p.color} flex items-center justify-center shrink-0`}>
              <span className="text-[7px] font-bold text-white">{p.iniciales}</span>
            </div>
            <p className="text-[8px] font-medium text-zinc-700 flex-1 truncate">{p.nombre}</p>
            <Badge color={p.rol === 'Dueña' ? 'blue' : 'green'}>{p.rol}</Badge>
          </div>
        ))}
      </div>
    </BrowserFrame>
  )
}

// 6. Cotizaciones Profesionales — PDF premium (ej. negocio de servicios)
export function MockupCotizaciones() {
  const items = [
    { nombre: 'Servicio de instalación', cant: 2, precio: 'S/ 380.00' },
    { nombre: 'Mantenimiento mensual', cant: 1, precio: 'S/ 278.00' },
  ]
  return (
    <BrowserFrame path="dashboard/cotizaciones/pdf">
      <div className="border border-zinc-200 rounded-lg p-2.5 bg-zinc-50/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold text-zinc-800">Cotización #0042</p>
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-red-500"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" opacity=".2"/><path d="M14 2v5h5M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </div>
        {items.map((it) => (
          <div key={it.nombre} className="flex justify-between py-1 border-b border-zinc-200/70">
            <p className="text-[7.5px] text-zinc-600 truncate">{it.cant}× {it.nombre}</p>
            <p className="text-[7.5px] font-medium text-zinc-800">{it.precio}</p>
          </div>
        ))}
        <div className="flex justify-between pt-1.5">
          <p className="text-[8px] font-bold text-zinc-900">Total</p>
          <p className="text-[8px] font-bold text-blue-600">S/ 658.00</p>
        </div>
      </div>
      <div className="mt-2 bg-emerald-500 text-white text-[7px] font-semibold text-center py-1.5 rounded-lg">
        Enviar por WhatsApp
      </div>
    </BrowserFrame>
  )
}
