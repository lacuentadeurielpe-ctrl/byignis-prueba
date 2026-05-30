'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Check, User, Building2, UserX, Tag, Phone, Mail, MapPin, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

type TipoCliente = 'persona' | 'empresa' | 'anonimo'

interface EditarClienteModalProps {
  cliente: {
    id: string
    nombre: string | null
    telefono: string | null
    dni_ruc: string | null
    tipo: TipoCliente
    alias: string | null
    email: string | null
    telefono_secundario: string | null
    direccion_habitual: string | null
    tags: string[]
    notas_internas: string | null
  }
  onClose: () => void
  onGuardado?: (actualizado: { nombre: string | null; alias: string | null; dni_ruc: string | null; tipo: TipoCliente }) => void
}

const TAGS_SUGERIDOS = ['VIP', 'Mayorista', 'Constructor', 'Empresa', 'Frecuente', 'Riesgo']

const TIPOS: { value: TipoCliente; label: string; icon: typeof User; desc: string; color: string }[] = [
  { value: 'persona', label: 'Persona natural', icon: User, desc: 'Cliente individual con nombre y teléfono', color: 'blue' },
  { value: 'empresa', label: 'Empresa', icon: Building2, desc: 'Persona jurídica, puede tener RUC', color: 'violet' },
  { value: 'anonimo', label: 'Anónimo', icon: UserX, desc: 'Venta sin datos — sin crédito ni delivery', color: 'zinc' },
]

export default function EditarClienteModal({ cliente, onClose, onGuardado }: EditarClienteModalProps) {
  const router = useRouter()

  const [nombre, setNombre] = useState(cliente.nombre ?? '')
  const [alias, setAlias] = useState(cliente.alias ?? '')
  const [dniRuc, setDniRuc] = useState(cliente.dni_ruc ?? '')
  const [tipo, setTipo] = useState<TipoCliente>(cliente.tipo ?? 'persona')
  const [email, setEmail] = useState(cliente.email ?? '')
  const [telefonoSecundario, setTelefonoSecundario] = useState(cliente.telefono_secundario ?? '')
  const [direccionHabitual, setDireccionHabitual] = useState(cliente.direccion_habitual ?? '')
  const [tags, setTags] = useState<string[]>(cliente.tags ?? [])
  const [notasInternas, setNotasInternas] = useState(cliente.notas_internas ?? '')
  const [tagInput, setTagInput] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function agregarTagPersonalizado() {
    const t = tagInput.trim().toUpperCase()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }

  function labelDniRuc() {
    if (tipo === 'empresa') return 'RUC'
    return 'DNI'
  }

  function validarDniRuc(valor: string) {
    const limpio = valor.replace(/\D/g, '')
    if (!limpio) return true // opcional
    if (tipo === 'empresa') return limpio.length === 11
    if (tipo === 'persona') return limpio.length === 8
    return true
  }

  async function guardar() {
    if (tipo !== 'anonimo' && !nombre.trim() && !cliente.telefono && !dniRuc.trim()) {
      setError('El cliente debe tener al menos nombre, teléfono o DNI/RUC')
      return
    }

    const dniLimpio = dniRuc.replace(/\D/g, '')
    if (dniLimpio && !validarDniRuc(dniRuc)) {
      setError(tipo === 'empresa'
        ? 'El RUC debe tener exactamente 11 dígitos'
        : 'El DNI debe tener exactamente 8 dígitos'
      )
      return
    }

    setGuardando(true)
    setError(null)

    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim() || null,
          alias: alias.trim() || null,
          dni_ruc: dniLimpio || null,
          tipo,
          email: email.trim() || null,
          telefono_secundario: telefonoSecundario.trim() || null,
          direccion_habitual: direccionHabitual.trim() || null,
          tags,
          notas_internas: notasInternas.trim() || null,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Error al guardar')
      }

      onGuardado?.({ nombre: nombre || null, alias: alias || null, dni_ruc: dniLimpio || null, tipo })
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Editar ficha de cliente</h2>
            <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
              {cliente.telefono ? `+${cliente.telefono}` : cliente.dni_ruc ? `${labelDniRuc()}: ${cliente.dni_ruc}` : 'Sin identificador'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Tipo de cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tipo de cliente</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(({ value, label, icon: Icon, desc, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTipo(value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition text-xs',
                    tipo === value
                      ? color === 'blue' ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : color === 'violet' ? 'bg-violet-50 border-violet-300 text-violet-700'
                        : 'bg-zinc-100 border-zinc-400 text-zinc-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                  title={desc}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nombre y alias */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Nombre {tipo !== 'anonimo' && <span className="text-gray-400">(recomendado)</span>}
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={tipo === 'empresa' ? 'Constructora ABC SAC' : 'Juan Pérez'}
                disabled={tipo === 'anonimo'}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Alias interno</label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="El plomero de San Isidro"
                disabled={tipo === 'anonimo'}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* DNI / RUC */}
          {tipo !== 'anonimo' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {labelDniRuc()}
                <span className="text-gray-400 ml-1">
                  {tipo === 'empresa' ? '(11 dígitos — obligatorio para facturas)' : '(8 dígitos — opcional en boletas)'}
                </span>
              </label>
              <input
                value={dniRuc}
                onChange={(e) => setDniRuc(e.target.value.replace(/\D/g, '').slice(0, tipo === 'empresa' ? 11 : 8))}
                placeholder={tipo === 'empresa' ? '20123456789' : '12345678'}
                maxLength={tipo === 'empresa' ? 11 : 8}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {dniRuc && !validarDniRuc(dniRuc) && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {tipo === 'empresa' ? 'El RUC debe tener 11 dígitos' : 'El DNI debe tener 8 dígitos'}
                </p>
              )}
            </div>
          )}

          {/* Email y teléfono secundario */}
          {tipo !== 'anonimo' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Mail className="w-3 h-3 inline mr-1" />Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Phone className="w-3 h-3 inline mr-1" />Teléfono secundario
                </label>
                <input
                  value={telefonoSecundario}
                  onChange={(e) => setTelefonoSecundario(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder="51987654321"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          )}

          {/* Dirección habitual */}
          {tipo !== 'anonimo' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                <MapPin className="w-3 h-3 inline mr-1" />Dirección habitual
              </label>
              <input
                value={direccionHabitual}
                onChange={(e) => setDireccionHabitual(e.target.value)}
                placeholder="Jr. Los Ferreros 123, Miraflores"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400 mt-0.5">Se pre-llena automáticamente en delivery</p>
            </div>
          )}

          {/* Tags */}
          {tipo !== 'anonimo' && (
            <div>
              <label className="block text-xs text-gray-500 mb-2">
                <Tag className="w-3 h-3 inline mr-1" />Etiquetas
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {TAGS_SUGERIDOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition',
                      tags.includes(t)
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tags.filter(t => !TAGS_SUGERIDOS.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.filter(t => !TAGS_SUGERIDOS.includes(t)).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-100 border-blue-300 text-blue-700 transition"
                    >
                      {t} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTagPersonalizado() } }}
                  placeholder="Agregar etiqueta personalizada…"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={agregarTagPersonalizado}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition"
                >
                  Agregar
                </button>
              </div>
            </div>
          )}

          {/* Notas internas */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              <FileText className="w-3 h-3 inline mr-1" />Notas internas
            </label>
            <textarea
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
              rows={2}
              placeholder="Notas privadas del vendedor sobre este cliente…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-0.5">Estas notas solo las ve el equipo, no el cliente</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
