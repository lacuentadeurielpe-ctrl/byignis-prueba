<?php
declare(strict_types=1);

namespace App;

use Greenter\Model\Summary\Summary;
use Greenter\Model\Summary\SummaryDetail;
use Greenter\Model\Company\Company;
use Greenter\Model\Company\Address;

class ResumenDiarioFactory
{
    /**
     * Crea un Resumen Diario de Boletas (RC) para enviar a SUNAT.
     *
     * Body esperado:
     *   modo:        'beta' | 'produccion'
     *   emisor:      { ruc, razon_social, direccion, ubigeo, departamento, provincia, distrito }
     *   sol:         { usuario, clave }
     *   certificado: { pfx_base64, clave }
     *   fecha:       'YYYY-MM-DD' — fecha de EMISIÓN de las boletas (FecGeneracion)
     *   correlativo: int — número de secuencia del RC de ese día (1, 2, 3...)
     *   boletas:     [{ serie, numero, subtotal, igv, total, cliente_tipo, cliente_nro }]
     *
     * API Greenter verificada (thegreenter/core):
     *   Summary:       setCorrelativo, setFecGeneracion, setFecResumen, setMoneda, setCompany, setDetails
     *   SummaryDetail: setTipoDoc, setSerieNro, setEstado, setClienteTipo, setClienteNro,
     *                  setTotal, setMtoOperGravadas, setMtoIGV, setMtoOperInafectas, setMtoOperExoneradas
     */
    public static function crear(array $body): Summary
    {
        $emisorData  = $body['emisor']   ?? [];
        $boletasData = $body['boletas']  ?? [];
        $fecha       = $body['fecha']    ?? date('Y-m-d');
        $correlativo = (int)($body['correlativo'] ?? 1);
        $tz          = new \DateTimeZone('America/Lima');

        $company = new Company();
        $company
            ->setRuc($emisorData['ruc'] ?? '')
            ->setRazonSocial($emisorData['razon_social'] ?? '')
            ->setNombreComercial($emisorData['razon_social'] ?? '')
            ->setAddress(
                (new Address())
                    ->setUbigueo($emisorData['ubigeo']      ?? '150101')
                    ->setDepartamento(strtoupper($emisorData['departamento'] ?? 'LIMA'))
                    ->setProvincia(strtoupper($emisorData['provincia']   ?? 'LIMA'))
                    ->setDistrito(strtoupper($emisorData['distrito']    ?? 'LIMA'))
                    ->setUrbanizacion('-')
                    ->setDireccion($emisorData['direccion'] ?? '-')
            );

        $detalles = [];
        foreach ($boletasData as $boleta) {
            $subtotal    = round((float)($boleta['subtotal'] ?? 0), 2);
            $igv         = round((float)($boleta['igv']      ?? 0), 2);
            $total       = round((float)($boleta['total']    ?? 0), 2);
            $serie       = $boleta['serie'] ?? 'B001';
            $numero      = (int)($boleta['numero'] ?? 1);
            $clienteTipo = (string)($boleta['cliente_tipo'] ?? '1');
            $clienteNro  = (string)($boleta['cliente_nro']  ?? '00000000');

            $detail = new SummaryDetail();
            $detail
                ->setTipoDoc('03')                                  // Boleta de Venta
                ->setSerieNro($serie . '-' . $numero)               // ej: B001-14
                ->setEstado('1')                                    // catálogo 19: 1=Adicionar
                ->setClienteTipo($clienteTipo)
                ->setClienteNro($clienteNro)
                ->setTotal($total)
                ->setMtoOperGravadas($subtotal)
                ->setMtoOperInafectas(0)
                ->setMtoOperExoneradas(0)
                ->setMtoIGV($igv);

            $detalles[] = $detail;
        }

        $summary = new Summary();
        $summary
            ->setCorrelativo(str_pad((string)$correlativo, 3, '0', STR_PAD_LEFT))
            ->setFecGeneracion(new \DateTime($fecha, $tz))          // fecha de emisión de las boletas
            ->setFecResumen(new \DateTime('now', $tz))             // fecha de envío del resumen
            ->setMoneda('PEN')
            ->setCompany($company)
            ->setDetails($detalles);

        return $summary;
    }
}
