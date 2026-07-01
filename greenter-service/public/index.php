<?php
declare(strict_types=1);

use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

require __DIR__ . '/../vendor/autoload.php';

$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->addErrorMiddleware(true, true, true);

// ── Health check ──────────────────────────────────────────────────────────────
$app->get('/health', function (Request $request, Response $response): Response {
    $response->getBody()->write(json_encode(['ok' => true, 'version' => '1.0.0']));
    return $response->withHeader('Content-Type', 'application/json');
});

// ── Verificar credenciales SUNAT (sin emitir nada) ───────────────────────────
$app->post('/verificar', function (Request $request, Response $response): Response {
    $body = (array) $request->getParsedBody();

    try {
        $see = \App\GreenterFactory::crearSee($body);
        // Envío de un XML mínimo de prueba para verificar autenticación
        $result = \App\GreenterFactory::verificarConexion($see, $body['ruc'] ?? '');
        $response->getBody()->write(json_encode(['ok' => true, 'mensaje' => 'Credenciales válidas']));
    } catch (\Throwable $e) {
        $response->getBody()->write(json_encode(['ok' => false, 'error' => $e->getMessage()]));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
    }

    return $response->withHeader('Content-Type', 'application/json');
});

// ── Emitir Boleta ─────────────────────────────────────────────────────────────
$app->post('/boleta/emitir', function (Request $request, Response $response): Response {
    $body = (array) $request->getParsedBody();

    try {
        $see      = \App\GreenterFactory::crearSee($body);
        $boleta   = \App\DocumentoFactory::crearBoleta($body);
        $resultado = $see->send($boleta);

        if (!$resultado->isSuccess()) {
            $err = $resultado->getError();
            throw new \RuntimeException(
                $err ? ('[' . $err->getCode() . '] ' . $err->getMessage()) : 'Error al enviar a SUNAT'
            );
        }

        $cdr = $resultado->getCdrResponse();
        // Códigos CDR: '0' = Aceptado, '2' = Aceptado con observaciones (válido), '1' = Rechazado
        if ($cdr && $cdr->getCode() !== '0' && $cdr->getCode() !== '2') {
            throw new \RuntimeException('SUNAT rechazó la boleta (CDR ' . $cdr->getCode() . '): ' . ($cdr->getDescription() ?? 'sin detalle'));
        }

        $pdfUrl = \App\PdfGenerator::generar($boleta, 'boleta', $body);
        $xmlUrl = \App\XmlStorage::guardar($boleta, 'boleta', $body);

        $response->getBody()->write(json_encode([
            'ok'             => true,
            'numero_completo' => $body['emisor']['serie'] . '-' . str_pad((string)$body['emisor']['numero'], 8, '0', STR_PAD_LEFT),
            'pdf_url'        => $pdfUrl,
            'xml_url'        => $xmlUrl,
            'cdr_codigo'     => $cdr?->getCode(),
            'cdr_descripcion' => $cdr?->getDescription(),
        ]));
    } catch (\Throwable $e) {
        $response->getBody()->write(json_encode(['ok' => false, 'error' => $e->getMessage()]));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
    }

    return $response->withHeader('Content-Type', 'application/json');
});

// ── Emitir Factura ────────────────────────────────────────────────────────────
$app->post('/factura/emitir', function (Request $request, Response $response): Response {
    $body = (array) $request->getParsedBody();

    try {
        $see      = \App\GreenterFactory::crearSee($body);
        $factura  = \App\DocumentoFactory::crearFactura($body);
        $resultado = $see->send($factura);

        if (!$resultado->isSuccess()) {
            $err = $resultado->getError();
            throw new \RuntimeException(
                $err ? ('[' . $err->getCode() . '] ' . $err->getMessage()) : 'Error al enviar a SUNAT'
            );
        }

        $cdr = $resultado->getCdrResponse();
        // Códigos CDR: '0' = Aceptado, '2' = Aceptado con observaciones (válido), '1' = Rechazado
        if ($cdr && $cdr->getCode() !== '0' && $cdr->getCode() !== '2') {
            throw new \RuntimeException('SUNAT rechazó la factura (CDR ' . $cdr->getCode() . '): ' . ($cdr->getDescription() ?? 'sin detalle'));
        }

        $pdfUrl = \App\PdfGenerator::generar($factura, 'factura', $body);
        $xmlUrl = \App\XmlStorage::guardar($factura, 'factura', $body);

        $response->getBody()->write(json_encode([
            'ok'             => true,
            'numero_completo' => $body['emisor']['serie'] . '-' . str_pad((string)$body['emisor']['numero'], 8, '0', STR_PAD_LEFT),
            'pdf_url'        => $pdfUrl,
            'xml_url'        => $xmlUrl,
            'cdr_codigo'     => $cdr?->getCode(),
            'cdr_descripcion' => $cdr?->getDescription(),
        ]));
    } catch (\Throwable $e) {
        $response->getBody()->write(json_encode(['ok' => false, 'error' => $e->getMessage()]));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
    }

    return $response->withHeader('Content-Type', 'application/json');
});

// ── Emitir Nota de Crédito ────────────────────────────────────────────────────
$app->post('/nota-credito/emitir', function (Request $request, Response $response): Response {
    $body = (array) $request->getParsedBody();

    try {
        $see  = \App\GreenterFactory::crearSee($body);
        $nota = \App\DocumentoFactory::crearNotaCredito($body);
        $resultado = $see->send($nota);

        if (!$resultado->isSuccess()) {
            $err = $resultado->getError();
            throw new \RuntimeException(
                $err ? ('[' . $err->getCode() . '] ' . $err->getMessage()) : 'Error al enviar a SUNAT'
            );
        }

        $cdr = $resultado->getCdrResponse();
        if ($cdr && $cdr->getCode() !== '0' && $cdr->getCode() !== '2') {
            throw new \RuntimeException('SUNAT rechazó la nota de crédito (CDR ' . $cdr->getCode() . '): ' . ($cdr->getDescription() ?? 'sin detalle'));
        }

        $pdfUrl = \App\PdfGenerator::generar($nota, 'nota_credito', $body);
        $xmlUrl = \App\XmlStorage::guardar($nota, 'nota_credito', $body);

        $response->getBody()->write(json_encode([
            'ok'              => true,
            'numero_completo' => $body['emisor']['serie'] . '-' . str_pad((string)$body['emisor']['numero'], 8, '0', STR_PAD_LEFT),
            'pdf_url'         => $pdfUrl,
            'xml_url'         => $xmlUrl,
            'cdr_codigo'      => $cdr?->getCode(),
            'cdr_descripcion' => $cdr?->getDescription(),
        ]));
    } catch (\Throwable $e) {
        $response->getBody()->write(json_encode(['ok' => false, 'error' => $e->getMessage()]));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
    }

    return $response->withHeader('Content-Type', 'application/json');
});

$app->run();
