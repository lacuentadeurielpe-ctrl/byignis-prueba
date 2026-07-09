'use client'

import { useState, useEffect } from 'react'
import { KeyRound, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { GRUPOS_PERMISOS, Permiso, PermisoMap } from '@/lib/auth/permisos'

export default function TabAccesosRoles({ empleadoId }: { empleadoId: string }) {
  const [loading, setLoading] = useState(true)
  const [empleado, setEmpleado] = useState<any>(null)
  
  // Estado local para los permisos (mapa completo true/false)
  const [permisos, setPermisos] = useState<Partial<PermisoMap>>({})
  
  const [pinMode, setPinMode] = useState<'hidden' | 'visible'>('hidden')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadEmpleado() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('miembros_ferreteria')
        .select('id, nombre, email, rol, activo, permisos, codigo_pin')
        .eq('id', empleadoId)
        .single()
      
      if (!error && data) {
        setEmpleado(data)
        setPermisos(data.permisos || {})
      }
      setLoading(false)
    }
    loadEmpleado()
  }, [empleadoId])

  const togglePermiso = (permisoKey: Permiso) => {
    setPermisos(prev => ({
      ...prev,
      [permisoKey]: !prev[permisoKey]
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/empleados/${empleadoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permisos })
      })

      if (res.ok) {
        setSuccess('Permisos actualizados correctamente')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al guardar permisos')
      }
    } catch (e) {
      setError('Error de conexión al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500 animate-pulse">Cargando permisos...</div>
  if (!empleado) return <div className="p-8 text-center text-rose-500">Error: Empleado no encontrado.</div>

  const isAdmin = empleado.rol === 'dueno'

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
      
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-start gap-3">
          <span className="shrink-0 font-bold">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      {/* Autenticación y PIN */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Credenciales de Acceso</h3>
            <p className="text-sm text-zinc-500">Administra cómo ingresa este usuario al sistema.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-700 block">PIN de Seguridad (App Móvil y POS)</label>
            <div className="flex items-center gap-4">
              <div className="bg-zinc-100 px-6 py-3 rounded-xl border border-zinc-200 font-mono text-2xl tracking-widest font-bold text-zinc-800">
                {pinMode === 'hidden' ? '••••' : (empleado.codigo_pin || '----')}
              </div>
              <button 
                onClick={() => setPinMode(p => p === 'hidden' ? 'visible' : 'hidden')}
                className="text-indigo-600 font-medium text-sm hover:underline"
              >
                {pinMode === 'hidden' ? 'Mostrar' : 'Ocultar'}
              </button>
            </div>
            <p className="text-xs text-zinc-500">El PIN se genera desde la App o POS en el primer inicio de sesión.</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-700 block">Acceso Web</label>
            <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Cuenta vinculada ({empleado.email}).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Permisos Granulares */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-100 flex items-start gap-4 bg-zinc-50/50">
          <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl shrink-0 mt-1">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Permisos Granulares</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
              Controla exactamente qué puede ver o modificar {empleado.nombre}.
            </p>
            {isAdmin && (
              <p className="text-sm font-bold text-orange-600 mt-2 bg-orange-100 p-2 rounded-lg inline-block">
                Este usuario es DUEÑO. Los permisos de abajo son ignorados (tiene acceso total a todo).
              </p>
            )}
          </div>
        </div>

        <div className="divide-y divide-zinc-100">
          {GRUPOS_PERMISOS.map(grupo => (
            <div key={grupo.label} className="p-5">
              <h4 className="font-bold text-zinc-800 mb-4 bg-zinc-100 px-3 py-1 inline-block rounded-md text-xs uppercase tracking-wider">{grupo.label}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grupo.permisos.map(permiso => {
                  const isActivo = permisos[permiso.key] === true
                  return (
                    <div key={permiso.key} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isActivo ? 'border-indigo-200 bg-indigo-50/30' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}>
                      <span className={`text-sm font-medium ${isActivo ? 'text-indigo-900' : 'text-zinc-600'}`}>{permiso.label}</span>
                      <button
                        disabled={isAdmin}
                        onClick={() => togglePermiso(permiso.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                          isActivo ? 'bg-indigo-600' : 'bg-zinc-200'
                        } ${isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        role="switch"
                        aria-checked={isActivo}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isActivo ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-4">
          {success && <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> {success}</span>}
          <button 
            disabled={isAdmin || isSaving}
            onClick={handleSave}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {isSaving ? 'Guardando...' : 'Guardar Permisos'}
          </button>
        </div>
      </div>
    </div>
  )
}
