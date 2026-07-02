<?php
declare(strict_types=1);

namespace App;

use Greenter\Model\Summary\Summary;
use Greenter\Model\Summary\SummaryDetail;
use Greenter\Model\Summary\BillingPayment;
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
     *   fecha:       'YYYY-MM-DD' — fecha de emisión de las boletas
     *   correlativo: int — número de secuencia del RC del día (1, 2, 3...)
     *   boletas:     [{ serie, numero, subtotal, igv, total }]
     */
    public static function crear(array $body): Summary
    {
        $emisorData  = $body['emisor']   ?? [];
        $boletasData = $body['boletas']  ?? [];
        $fecha       = $body['fecha']    ?? date('Y-m-d');
        $correlativo = (int)($body['correlativo'] ?? 1);

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
            $subtotal = round((float)($boleta['subtotal'] ?? 0), 2);
            $igv      = round((float)($boleta['igv']      ?? 0), 2);
            $total    = round((float)($boleta['total']    ?? 0), 2);
            $numero   = (int)($boleta['numero'] ?? 1);
            $serie    = $boleta['serie'] ?? 'B001';

            $detail = new SummaryDetail();
            $detail
                ->setTipoDoc('03')              // Boleta de Venta
                ->setSerie($serie)
                ->setCorrelativoInicio($numero)  // un comprobante por detalle
                ->setCorrelativoFin($numero)
                ->setTipoOperacion('0101')       // Venta interna
                ->setTotalOperGravadas($subtotal)
                ->setTotalIgv($igv)
                ->setMtoOperGravadas($subtotal)
                ->setMtoIGV($igv)
                ->setTotal($total)
                ->setBillingPayment(
                    (new BillingPayment())
                        ->setMoneda('PEN')
                        ->setImporte($total)
                );

            $detalles[] = $detail;
        }

        $summary = new Summary();
        $summary
            ->setFechaEmision(new \DateTime('now', new \DateTimeZone('America/Lima')))
            ->setFechaGeneracion(new \DateTime($fecha, new \DateTimeZone('America/Lima')))
            ->setCompany($company)
            ->setCorrelativo((string)$correlativo)
            ->setDetails($detalles);

        return $summary;
    }
}
