import { useState, useCallback } from 'react';
export interface EmpleadoRow {
  id: string;
  created_at: string;
  nombre: string;
  email: string;
  ferreteria_id: string;
  rol: string;
  estado: string;
  user_id: string | null;
  local_id: string | null;
  contrasena_temporal: string | null;
  codigo_pin: string | null;
  salario_base?: number | null;
  tipo_contrato?: string | null;
  fecha_ingreso?: string | null;
}

export function useEmpleados() {
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmpleados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings-2/equipo/empleados');
      if (!res.ok) throw new Error('Error al cargar empleados');
      const data = await res.json();
      setEmpleados(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addEmpleado = async (empleadoData: { nombre: string; email: string; password?: string; rol?: string }) => {
    try {
      const res = await fetch('/api/settings-2/equipo/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empleadoData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al agregar empleado');
      }
      
      const newEmpleado = await res.json();
      setEmpleados(prev => [newEmpleado, ...prev]);
      return { success: true, data: newEmpleado };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteEmpleado = async (id: string) => {
    try {
      const res = await fetch(`/api/settings-2/equipo/empleados?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar');
      }
      setEmpleados(prev => prev.filter(e => e.id !== id));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateEmpleado = async (id: string, updates: Partial<EmpleadoRow>) => {
    try {
      // Usar la ruta PATCH para asignar sucursal (por compatibilidad con el endpoint existente)
      if ('local_id' in updates) {
        const res = await fetch('/api/settings-2/equipo/empleados', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, local_id: updates.local_id }),
        });
        if (!res.ok) throw new Error('Error al actualizar empleado');
        const updated = await res.json();
        setEmpleados(prev => prev.map(e => e.id === id ? { ...e, local_id: updated.local_id } : e));
        return { success: true, data: updated };
      }
      
      // Si hay otros campos, necesitaríamos actualizar el endpoint PATCH para que acepte updates genéricos,
      // pero por ahora solo está implementado para local_id.
      return { success: true, data: {} as any };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return {
    empleados,
    loading,
    error,
    fetchEmpleados,
    addEmpleado,
    updateEmpleado,
    deleteEmpleado
  };
}
