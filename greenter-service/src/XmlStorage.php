<?php
declare(strict_types=1);

namespace App;

/**
 * Almacena el XML firmado del comprobante.
 * Greenter devuelve el XML firmado como string después de enviar a SUNAT.
 * En producción, subir a Supabase Storage o S3 y retornar la URL pública.
 */
class XmlStorage
{
    public static function guardar(object $documento, string $tipo, array $body): ?string
    {
        try {
            // El XML firmado está en el resultado de See::send(),
            // no en el documento mismo. Por eso XmlStorage recibe el
            // documento para generar el nombre, pero el XML lo pasa el caller.
            // Nota: en la arquitectura actual el XML no se persiste aquí
            // para no complicar el flujo en la V1. Se puede agregar en V2
            // subiendo a Supabase Storage usando SUPABASE_SERVICE_ROLE_KEY.
            return null;
        } catch (\Throwable $e) {
            error_log('[XmlStorage] Error: ' . $e->getMessage());
            return null;
        }
    }
}
