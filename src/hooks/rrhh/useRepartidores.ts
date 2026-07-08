import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
export interface RepartidorRow {
  id: string;
  created_at: string;
  nombre: string;
  telefono: string;
  tipo_vehiculo: string;
  placa: string | null;
  capacidad_kg: number | null;
  estado: string;
  ferreteria_id: string;
  user_id: string | null;
  costo_por_km?: number | null;
  salario_base?: number | null;
  tipo_contrato?: string | null;
}

export function useRepartidores(ferreteriaId: string) {
  const [repartidores, setRepartidores] = useState<RepartidorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const fetchRepartidores = useCallback(async () => {
    if (!ferreteriaId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('repartidores')
        .select('*')
        .eq('ferreteria_id', ferreteriaId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setRepartidores(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ferreteriaId]);

  const addRepartidor = async (repartidor: Omit<RepartidorRow, 'id' | 'created_at' | 'ferreteria_id' | 'user_id'>) => {
    if (!ferreteriaId) return { success: false, error: 'No ferreteria_id' };
    try {
      const { data, error } = await supabase
        .from('repartidores')
        .insert({ ...repartidor, ferreteria_id: ferreteriaId })
        .select()
        .single();
      
      if (error) throw error;
      setRepartidores(prev => [data, ...prev]);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateRepartidor = async (id: string, updates: Partial<RepartidorRow>) => {
    try {
      const { data, error } = await supabase
        .from('repartidores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      setRepartidores(prev => prev.map(r => r.id === id ? data : r));
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return {
    repartidores,
    loading,
    error,
    fetchRepartidores,
    addRepartidor,
    updateRepartidor
  };
}
