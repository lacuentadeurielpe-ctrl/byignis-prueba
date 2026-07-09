'use client'

import { useState } from 'react'
import { KeyRound, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react'

// Lista de permisos disponibles en el sistema
const PERMISOS_DISPONIBLES = [
  { id: 'ver_caja', label: 'Ver Caja POS', description: 'Permite abrir el punto de venta y registrar ventas.' },
  { id: 'gestionar_catalogo', label: 'Gestionar Catálogo', description: 'Permite crear, editar o eliminar productos.' },
  { id: 'ver_finanzas', label: 'Ver Finanzas', description: 'Acceso a dashboards de ingresos, gastos y contabilidad.' },
  { id: 'gestionar_equipo', label: 'Gestionar Equipo', description: 'Permite contratar, despedir y ver nóminas de otros.' },
  { id: 'configuracion_avanzada', label: 'Configuración Avanzada', description: 'Acceso a integraciones, IA y configuración del negocio.' },
]

export default function TabAccesosRoles({ empleadoId }: { empleadoId: string }) {
  // Estado mock para fase UI. Luego se conectará con la DB
  const [rolesActivos, setRolesActivos] = useState<string[]>(['ver_caja'])
  const [pinMode, setPinMode] = useState<'hidden' | 'visible'>('hidden')
  const pinCode = '1234' // Mock PIN

  const toggleRol = (rolId: string) => {
    setRolesActivos(prev => 
      prev.includes(rolId) 
        ? prev.filter(id => id !== rolId) 
        : [...prev, rolId]
    )
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
      
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
                {pinMode === 'hidden' ? '••••' : pinCode}
              </div>
              <button 
                onClick={() => setPinMode(p => p === 'hidden' ? 'visible' : 'hidden')}
                className="text-indigo-600 font-medium text-sm hover:underline"
              >
                {pinMode === 'hidden' ? 'Mostrar' : 'Ocultar'}
              </button>
            </div>
            <button className="text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors">
              Regenerar PIN aleatorio
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-700 block">Acceso Web</label>
            <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">El usuario tiene una cuenta vinculada mediante correo electrónico.</p>
            </div>
            <button className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
              Revocar acceso web
            </button>
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
              Controla exactamente qué puede ver o modificar este usuario. Si el usuario es "Administrador", 
              tendrá acceso total y estas reglas serán ignoradas.
            </p>
          </div>
        </div>

        <div className="divide-y divide-zinc-100">
          {PERMISOS_DISPONIBLES.map(permiso => {
            const isActivo = rolesActivos.includes(permiso.id)
            return (
              <div key={permiso.id} className="p-5 flex items-center justify-between gap-6 hover:bg-zinc-50/50 transition-colors">
                <div>
                  <h4 className="font-semibold text-zinc-900">{permiso.label}</h4>
                  <p className="text-sm text-zinc-500 mt-1">{permiso.description}</p>
                </div>
                
                {/* Custom Toggle Switch */}
                <button
                  onClick={() => toggleRol(permiso.id)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    isActivo ? 'bg-indigo-600' : 'bg-zinc-200'
                  }`}
                  role="switch"
                  aria-checked={isActivo}
                >
                  <span className="sr-only">Habilitar {permiso.label}</span>
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isActivo ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
        
        <div className="p-5 bg-zinc-50 border-t border-zinc-100 flex justify-end">
          <button className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Guardar Permisos
          </button>
        </div>
      </div>
    </div>
  )
}
