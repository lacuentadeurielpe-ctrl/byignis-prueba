<?php
declare(strict_types=1);

namespace App;

use Greenter\See;
use Greenter\Ws\Services\SunatEndpoints;

class GreenterFactory
{
    /**
     * Crea un cliente SEE (SUNAT Electronic Exchange) con las credenciales del tenant.
     *
     * El payload incluye:
     *   - modo: 'beta' | 'produccion'
     *   - sol.usuario, sol.clave
     *   - certificado.pfx_base64, certificado.clave
     */
    public static function crearSee(array $payload): See
    {
        $modo = $payload['modo'] ?? 'beta';
        $sol  = $payload['sol'] ?? [];
        $cert = $payload['certificado'] ?? [];

        // Decodificar el .pfx de base64 a bytes
        $pfxBytes = base64_decode($cert['pfx_base64'] ?? '');
        if (!$pfxBytes) {
            throw new \InvalidArgumentException('El certificado PFX no es válido (base64 inválido)');
        }

        // Parsear el PFX para obtener clave privada y certificado público
        $pfxData = [];
        if (!openssl_pkcs12_read($pfxBytes, $pfxData, $cert['clave'] ?? '')) {
            throw new \RuntimeException('No se pudo leer el certificado PFX. Verifica la contraseña.');
        }

        $see = new See();
        $see->setCertificate($pfxData['cert']);
        $see->setPrivateKey($pfxData['pkey']);

        // Credenciales SOL
        $ruc     = $payload['ruc'] ?? ($payload['emisor']['ruc'] ?? '');
        $usuario = $sol['usuario'] ?? '';
        $clave   = $sol['clave'] ?? '';

        // El usuario SOL completo es RUC + sufijo (ej: 20123456789MODDATOS)
        $usuarioCompleto = strlen($usuario) > 11 ? $usuario : $ruc . $usuario;

        $see->setCredentials($usuarioCompleto, $clave);

        // Endpoints según modo
        if ($modo === 'produccion') {
            $see->setService(SunatEndpoints::FE_PRODUCCION);
        } else {
            $see->setService(SunatEndpoints::FE_BETA);
        }

        return $see;
    }

    /**
     * Intenta obtener el estado de un ticket ficticio para verificar que
     * las credenciales SOL son válidas (retorna error 98 si son correctas).
     */
    public static function verificarConexion(See $see, string $ruc): bool
    {
        // Greenter provee un método de verificación mínima
        // Si las credenciales son inválidas arroja excepción antes de conectar
        // Una forma robusta: intentar consultar el estado de un documento inexistente
        // SUNAT devuelve error de "documento no encontrado" (no autenticación)
        // si las credenciales son válidas.
        try {
            $see->getStatus('20000000000-01-B001-00000001');
            return true;
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            // Si dice "no encontrado" o "0152" → credenciales OK, documento no existe
            if (str_contains($msg, '0152') || str_contains($msg, 'no encontrado') || str_contains($msg, 'not found')) {
                return true;
            }
            // Si dice "autenticación" o "credentials" → credenciales malas
            throw $e;
        }
    }
}
