<?php
declare(strict_types=1);

namespace App;

use Greenter\Model\Sale\Invoice;
use Greenter\Model\Sale\Note;
use Greenter\Model\Sale\SaleDetail;
use Greenter\Model\Sale\Legend;
use Greenter\Model\Client\Client;
use Greenter\Model\Company\Company;
use Greenter\Model\Company\Address;

class DocumentoFactory
{
    private static function crearEmisor(array $emisorData): Company
    {
        $company = new Company();
        $company->setRuc($emisorData['ruc']);
        $company->setRazonSocial($emisorData['razon_social'] ?? '');
        $company->setNombreComercial($emisorData['nombre_comercial'] ?? $emisorData['razon_social'] ?? '');
        $company->setAddress(
            (new Address())
                ->setUbigueo($emisorData['ubigeo'] ?? '150101')
                ->setDepartamento(strtoupper($emisorData['departamento'] ?? 'LIMA'))
                ->setProvincia(strtoupper($emisorData['provincia'] ?? 'LIMA'))
                ->setDistrito(strtoupper($emisorData['distrito'] ?? 'LIMA'))
                ->setUrbanizacion('-')
                ->setDireccion($emisorData['direccion'] ?? '-')
        );
        return $company;
    }

    private static function crearCliente(array $clienteData): Client
    {
        $client = new Client();
        $client->setTipoDoc($clienteData['tipo_doc'] ?? '0');
        $client->setNumDoc($clienteData['numero_doc'] ?? '00000000');
        $client->setRznSocial($clienteData['nombre'] ?? 'CLIENTES VARIOS');
        return $client;
    }

    /** Convierte unidad interna → código SUNAT */
    private static function unidadSunat(string $unidad): string
    {
        $mapa = [
            'niu' => 'NIU', 'und' => 'NIU', 'unidad' => 'NIU', 'unidades' => 'NIU',
            'kg' => 'KGM', 'kgm' => 'KGM', 'kilo' => 'KGM',
            'l' => 'LTR', 'lt' => 'LTR', 'litro' => 'LTR',
            'm' => 'MTR', 'metro' => 'MTR',
            'caja' => 'BX', 'saco' => 'SAC', 'bolsa' => 'BG',
        ];
        return $mapa[strtolower(trim($unidad))] ?? 'NIU';
    }

    private static function calcularItems(array $items, bool $igvIncluido): array
    {
        $detalles = [];
        $igvRate  = 0.18;

        foreach ($items as $i => $item) {
            $precioUnitario  = (float)($item['precio_unitario'] ?? 0);
            $cantidad        = (float)($item['cantidad'] ?? 1);

            // Greenter trabaja con valor unitario (sin IGV) y calcula el total con IGV
            $valorUnitario = $igvIncluido
                ? round($precioUnitario / (1 + $igvRate), 10)
                : $precioUnitario;

            $mtoValorVenta = round($valorUnitario * $cantidad, 2);
            $igvItem       = round($mtoValorVenta * $igvRate, 2);
            $mtoTotal      = round($mtoValorVenta + $igvItem, 2);

            $detalle = new SaleDetail();
            $detalle
                ->setCodProducto(str_pad((string)($i + 1), 3, '0', STR_PAD_LEFT))
                ->setUnidad(self::unidadSunat($item['unidad'] ?? 'NIU'))
                ->setDescripcion($item['descripcion'] ?? 'Producto')
                ->setCantidad($cantidad)
                ->setMtoValorUnitario($valorUnitario)
                ->setMtoValorVenta($mtoValorVenta)
                ->setMtoBaseIgv($mtoValorVenta)
                ->setPorIgv(18.0)
                ->setIgv($igvItem)
                ->setTipAfeIgv('10')  // Gravado - Operación Onerosa
                ->setTotalImpuestos($igvItem)
                ->setMtoPrecioUnitario(round($precioUnitario, 2))
                ->setMtoTotal($mtoTotal);

            $detalles[] = $detalle;
        }

        return $detalles;
    }

    public static function crearBoleta(array $body): Invoice
    {
        $emisorData  = $body['emisor']  ?? [];
        $clienteData = $body['cliente'] ?? [];
        $items       = $body['items']   ?? [];
        $igvIncluido = (bool)($body['igv_incluido'] ?? false);

        $detalles = self::calcularItems($items, $igvIncluido);

        $mtoOperGravadas = array_sum(array_map(fn($d) => $d->getMtoValorVenta(), $detalles));
        $mtoIGV          = array_sum(array_map(fn($d) => $d->getIgv(), $detalles));
        $mtoTotal        = round($mtoOperGravadas + $mtoIGV, 2);

        $invoice = new Invoice();
        $invoice
            ->setUblVersion('2.1')
            ->setTipoOperacion('0101')
            ->setTipoDoc('03')  // Boleta
            ->setSerie($emisorData['serie'] ?? 'B001')
            ->setCorrelativo((string)($emisorData['numero'] ?? 1))
            ->setFechaEmision(new \DateTime('now', new \DateTimeZone('America/Lima')))
            ->setCompany(self::crearEmisor($emisorData))
            ->setClient(self::crearCliente($clienteData))
            ->setMtoOperGravadas($mtoOperGravadas)
            ->setMtoIGV($mtoIGV)
            ->setTotalImpuestos($mtoIGV)
            ->setValorVenta($mtoOperGravadas)
            ->setMtoImpVenta($mtoTotal)
            ->setDetails($detalles)
            ->setLegends([
                (new Legend())
                    ->setCode('1000')
                    ->setValue(self::numeroALetras($mtoTotal)),
            ]);

        return $invoice;
    }

    public static function crearFactura(array $body): Invoice
    {
        $emisorData  = $body['emisor']  ?? [];
        $clienteData = $body['cliente'] ?? [];
        $items       = $body['items']   ?? [];
        $igvIncluido = (bool)($body['igv_incluido'] ?? false);

        $detalles = self::calcularItems($items, $igvIncluido);

        $mtoOperGravadas = array_sum(array_map(fn($d) => $d->getMtoValorVenta(), $detalles));
        $mtoIGV          = array_sum(array_map(fn($d) => $d->getIgv(), $detalles));
        $mtoTotal        = round($mtoOperGravadas + $mtoIGV, 2);

        $invoice = new Invoice();
        $invoice
            ->setUblVersion('2.1')
            ->setTipoOperacion('0101')
            ->setTipoDoc('01')  // Factura
            ->setSerie($emisorData['serie'] ?? 'F001')
            ->setCorrelativo((string)($emisorData['numero'] ?? 1))
            ->setFechaEmision(new \DateTime('now', new \DateTimeZone('America/Lima')))
            ->setCompany(self::crearEmisor($emisorData))
            ->setClient(self::crearCliente($clienteData))
            ->setMtoOperGravadas($mtoOperGravadas)
            ->setMtoIGV($mtoIGV)
            ->setTotalImpuestos($mtoIGV)
            ->setValorVenta($mtoOperGravadas)
            ->setMtoImpVenta($mtoTotal)
            ->setDetails($detalles)
            ->setLegends([
                (new Legend())->setCode('1000')->setValue(self::numeroALetras($mtoTotal)),
            ]);

        return $invoice;
    }

    public static function crearNotaCredito(array $body): Note
    {
        $emisorData  = $body['emisor']  ?? [];
        $clienteData = $body['cliente'] ?? [];
        $items       = $body['items']   ?? [];
        $igvIncluido = (bool)($body['igv_incluido'] ?? false);
        $ref         = $body['documento_referencia'] ?? [];

        $detalles = self::calcularItems($items, $igvIncluido);

        $mtoOperGravadas = array_sum(array_map(fn($d) => $d->getMtoValorVenta(), $detalles));
        $mtoIGV          = array_sum(array_map(fn($d) => $d->getIgv(), $detalles));
        $mtoTotal        = round($mtoOperGravadas + $mtoIGV, 2);

        // Tipo NC según tipo de documento original
        $tipoDoc = ($ref['tipo'] ?? '03') === '01' ? '07' : '07';  // 07 = NC de factura o boleta

        $note = new Note();
        $note
            ->setUblVersion('2.1')
            ->setTipoDoc($tipoDoc)
            ->setSerie($emisorData['serie'] ?? 'BC01')
            ->setCorrelativo((string)($emisorData['numero'] ?? 1))
            ->setFechaEmision(new \DateTime('now', new \DateTimeZone('America/Lima')))
            ->setTipDocAfectado($ref['tipo'] ?? '03')
            ->setNumDocfectado($ref['serie'] . '-' . $ref['numero'])
            ->setCodMotivo($body['motivo_codigo'] ?? '01')
            ->setDesMotivo($body['motivo_descripcion'] ?? 'Anulación')
            ->setCompany(self::crearEmisor($emisorData))
            ->setClient(self::crearCliente($clienteData))
            ->setMtoOperGravadas($mtoOperGravadas)
            ->setMtoIGV($mtoIGV)
            ->setTotalImpuestos($mtoIGV)
            ->setValorVenta($mtoOperGravadas)
            ->setMtoImpVenta($mtoTotal)
            ->setDetails($detalles);

        return $note;
    }

    private static function numeroALetras(float $monto): string
    {
        $entero   = (int)floor($monto);
        $centavos = (int)round(($monto - $entero) * 100);
        $palabras = self::enteroALetras($entero);
        return 'SON ' . strtoupper($palabras) . ' CON ' . str_pad((string)$centavos, 2, '0', STR_PAD_LEFT) . '/100 SOLES';
    }

    private static function enteroALetras(int $n): string
    {
        if ($n === 0) return 'CERO';

        $unidades  = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        $especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        $decenas   = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        $centenas  = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        $resultado = '';

        if ($n >= 1000000) {
            $m = intdiv($n, 1000000);
            $resultado .= ($m === 1 ? 'UN MILLÓN' : self::enteroALetras($m) . ' MILLONES') . ' ';
            $n %= 1000000;
        }

        if ($n >= 1000) {
            $m = intdiv($n, 1000);
            $resultado .= ($m === 1 ? 'MIL' : self::enteroALetras($m) . ' MIL') . ' ';
            $n %= 1000;
        }

        if ($n >= 100) {
            $c = intdiv($n, 100);
            $resultado .= ($n === 100 ? 'CIEN' : $centenas[$c]) . ' ';
            $n %= 100;
        }

        if ($n >= 20) {
            $d = intdiv($n, 10);
            $u = $n % 10;
            $resultado .= $decenas[$d] . ($u > 0 ? ' Y ' . $unidades[$u] : '') . ' ';
        } elseif ($n >= 10) {
            $resultado .= $especiales[$n - 10] . ' ';
        } elseif ($n > 0) {
            $resultado .= ($n === 1 ? 'UNO' : $unidades[$n]) . ' ';
        }

        return trim($resultado);
    }
}
