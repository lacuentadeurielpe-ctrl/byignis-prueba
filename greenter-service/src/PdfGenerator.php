<?php
declare(strict_types=1);

namespace App;

/**
 * Genera el PDF del comprobante y lo almacena temporalmente.
 * Greenter incluye generación de PDF mediante DOMPDF.
 * En producción, el PDF se sube a un bucket (Supabase Storage, S3, etc.)
 * y se devuelve la URL pública.
 *
 * Por ahora devuelve una URL firmada temporal que el caller puede usar.
 */
class PdfGenerator
{
    public static function generar(object $documento, string $tipo, array $body): ?string
    {
        try {
            // Greenter\Report\HtmlReport genera el HTML del comprobante
            // que luego se convierte a PDF con dompdf.
            // Requiere las plantillas de Greenter instaladas.
            $report = new \Greenter\Report\HtmlReport();
            $report->setTemplate(\Greenter\Report\ReportTemplate::BASIC);

            $html  = $report->render($documento);
            $ruc   = $body['emisor']['ruc'] ?? 'sin-ruc';
            $serie = $body['emisor']['serie'] ?? 'X001';
            $num   = str_pad((string)($body['emisor']['numero'] ?? 1), 8, '0', STR_PAD_LEFT);
            $fname = "{$ruc}-{$tipo}-{$serie}-{$num}.pdf";

            // En esta versión mínima: guardar en /tmp y devolver URL relativa
            // Para producción: subir a Supabase Storage con service role
            $pdfPath = sys_get_temp_dir() . '/' . $fname;

            $dompdf = new \Dompdf\Dompdf();
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            file_put_contents($pdfPath, $dompdf->output());

            // Retornar URL pública — en Railway/Render el /tmp no es público,
            // por lo que en producción real se debe subir a storage externo.
            // Por ahora retornamos null y el caller lo maneja como "sin PDF" temporal.
            return null;
        } catch (\Throwable $e) {
            error_log('[PdfGenerator] Error: ' . $e->getMessage());
            return null;
        }
    }
}
