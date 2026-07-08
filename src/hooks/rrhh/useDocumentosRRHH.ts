import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
export interface DocumentoRow {
  id: string;
  ferreteria_id: string;
  entidad_id: string;
  entidad_tipo: string;
  tipo_documento: string;
  file_path: string;
  file_name: string;
  file_size: number;
  estado: string;
  created_by: string;
  created_at: string;
}

export function useDocumentosRRHH(ferreteriaId: string, userId: string, entidadId?: string, entidadTipo?: 'empleado' | 'repartidor') {
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchDocumentos = useCallback(async () => {
    if (!ferreteriaId || !entidadId || !entidadTipo) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('documentos_rrhh')
        .select('*')
        .eq('ferreteria_id', ferreteriaId)
        .eq('entidad_id', entidadId)
        .eq('entidad_tipo', entidadTipo)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setDocumentos(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ferreteriaId, entidadId, entidadTipo]);

  const uploadDocumento = async (file: File, tipoDocumento: string) => {
    if (!ferreteriaId || !entidadId || !entidadTipo || !userId) {
      return { success: false, error: 'Faltan parámetros' };
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${entidadId}_${Date.now()}.${fileExt}`;
      const filePath = `${ferreteriaId}/${entidadTipo}s/${fileName}`;

      // Subir archivo a bucket
      const { error: uploadError } = await supabase.storage
        .from('rrhh_docs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Guardar referencia en DB
      const { data, error: dbError } = await supabase
        .from('documentos_rrhh')
        .insert({
          ferreteria_id: ferreteriaId,
          entidad_id: entidadId,
          entidad_tipo: entidadTipo,
          tipo_documento: tipoDocumento,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          created_by: userId
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setDocumentos(prev => [data, ...prev]);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteDocumento = async (id: string, filePath: string) => {
    try {
      // Eliminar de storage
      const { error: storageError } = await supabase.storage
        .from('rrhh_docs')
        .remove([filePath]);
      
      if (storageError) throw storageError;

      // Eliminar de DB
      const { error: dbError } = await supabase
        .from('documentos_rrhh')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      setDocumentos(prev => prev.filter(d => d.id !== id));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getDocumentUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('rrhh_docs')
      .createSignedUrl(filePath, 3600); // 1 hora de validez
    return data?.signedUrl;
  };

  return {
    documentos,
    loading,
    error,
    fetchDocumentos,
    uploadDocumento,
    deleteDocumento,
    getDocumentUrl
  };
}
