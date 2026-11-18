<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Services\TransactionFilterService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class TransactionExportController extends Controller
{
    public const MAX_EXPORT_ROWS = 10000;

    public function __construct(
        private readonly TransactionFilterService $filterService,
    ) {}

    /**
     * Ekspor riwayat transaksi sesuai filter aktif ke PDF (khusus Admin, FR-010, maks 10.000 baris).
     */
    public function exportPdf(Request $request): Response
    {
        $filteredQuery = $this->filterService->apply(Transaction::query(), $request);

        if ($errorResponse = $this->validateExportBounds($filteredQuery)) {
            return $errorResponse;
        }

        $summary = $this->filterService->computeSummary($filteredQuery);
        $meta = $this->filterService->describePeriodAndFilters($request);

        $transactions = (clone $filteredQuery)
            ->with(['workType', 'recorder'])
            ->withCount('photos')
            ->orderByDesc('transaction_datetime')
            ->orderByDesc('id')
            ->get();

        $rows = $transactions->map(function (Transaction $tx): array {
            $isInbound = $tx->isMasuk();

            return [
                'id' => $tx->id,
                'is_inbound' => $isInbound,
                'type_label' => $isInbound ? 'Barang Masuk' : 'Barang Keluar',
                'datetime' => $this->filterService->formatIndonesianDateTime($tx->transaction_datetime),
                'item_name' => $tx->item_name,
                'quantity_formatted' => $this->formatQuantity((float) $tx->quantity),
                'unit' => $tx->unit,
                'work_type' => $tx->workType?->name ?? '-',
                'location' => ($isInbound ? $tx->origin : $tx->destination) ?? '-',
                'counterparty' => ($isInbound ? $tx->sender_name : $tx->taker_name) ?? '-',
                'officer' => ($isInbound ? $tx->recipient_name : $tx->giver_name) ?? ($tx->recorder?->name ?? '-'),
                'description' => $tx->work_description,
                'photos_count' => (int) ($tx->photos_count ?? 0),
            ];
        })->values()->all();

        $pdf = Pdf::loadView('exports.transactions-pdf', [
            'rows' => $rows,
            'summary' => $summary,
            'periodLabel' => $meta['period_label'],
            'activeFilters' => $meta['active_filters'],
            'printedBy' => $request->user()?->name ?? 'Admin',
            'printedAt' => $this->filterService->formatIndonesianDateTime(now()),
        ])->setPaper('a4', 'landscape');

        $filename = $this->buildFilename('pdf');

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * Ekspor riwayat transaksi sesuai filter aktif ke Excel .xlsx (khusus Admin, FR-010, maks 10.000 baris).
     */
    public function exportExcel(Request $request): BinaryFileResponse|JsonResponse
    {
        $filteredQuery = $this->filterService->apply(Transaction::query(), $request);

        if ($errorResponse = $this->validateExportBounds($filteredQuery)) {
            return $errorResponse;
        }

        $summary = $this->filterService->computeSummary($filteredQuery);
        $meta = $this->filterService->describePeriodAndFilters($request);

        $tempPath = tempnam(sys_get_temp_dir(), 'inouttrack_export_');
        if ($tempPath === false) {
            return response()->json([
                'message' => 'Gagal menyiapkan berkas ekspor sementara.',
            ], 500);
        }

        $xlsxPath = $tempPath . '.xlsx';
        @unlink($tempPath);

        $options = new Options();
        $options->setColumnWidth(6, 1);
        $options->setColumnWidth(10, 2);
        $options->setColumnWidth(16, 3);
        $options->setColumnWidth(22, 4);
        $options->setColumnWidth(28, 5);
        $options->setColumnWidth(12, 6);
        $options->setColumnWidth(12, 7);
        $options->setColumnWidth(22, 8);
        $options->setColumnWidth(26, 9);
        $options->setColumnWidth(22, 10);
        $options->setColumnWidth(22, 11);
        $options->setColumnWidth(32, 12);
        $options->setColumnWidth(12, 13);

        $titleStyle = (new Style())
            ->setFontBold()
            ->setFontSize(14)
            ->setFontColor(Color::DARK_BLUE);

        $metaStyle = (new Style())
            ->setFontSize(10)
            ->setFontColor(Color::BLACK);

        $headerStyle = (new Style())
            ->setFontBold()
            ->setFontSize(11)
            ->setFontColor(Color::WHITE)
            ->setBackgroundColor('1E3A8A');

        $writer = new Writer($options);
        $writer->openToFile($xlsxPath);

        $writer->addRow(Row::fromValues(['LAPORAN RIWAYAT TRANSAKSI BARANG MASUK & KELUAR - INOUTTRACK'], $titleStyle));
        $writer->addRow(Row::fromValues(['Periode', $meta['period_label']], $metaStyle));
        $writer->addRow(Row::fromValues([
            'Filter Aktif',
            count($meta['active_filters']) > 0 ? implode(' | ', $meta['active_filters']) : 'Semua Data',
        ], $metaStyle));
        $writer->addRow(Row::fromValues([
            'Ringkasan',
            sprintf('Total: %d | Barang Masuk: %d | Barang Keluar: %d', $summary['total'], $summary['masuk'], $summary['keluar']),
        ], $metaStyle));
        $writer->addRow(Row::fromValues([
            'Dicetak Oleh',
            ($request->user()?->name ?? 'Admin') . ' (' . $this->filterService->formatIndonesianDateTime(now()) . ')',
        ], $metaStyle));
        $writer->addRow(Row::fromValues([]));

        $writer->addRow(Row::fromValues([
            'No',
            'ID Transaksi',
            'Jenis Transaksi',
            'Tanggal & Waktu',
            'Nama Barang',
            'Jumlah',
            'Satuan',
            'Jenis Pekerjaan',
            'Asal / Tujuan',
            'Pengantar / Pengambil',
            'Petugas Pencatat',
            'Deskripsi Pekerjaan',
            'Jumlah Foto',
        ], $headerStyle));

        $rowNumber = 1;
        (clone $filteredQuery)
            ->with(['workType', 'recorder'])
            ->withCount('photos')
            ->orderByDesc('transaction_datetime')
            ->orderByDesc('id')
            ->chunk(500, function ($chunk) use ($writer, &$rowNumber): void {
                foreach ($chunk as $tx) {
                    /** @var Transaction $tx */
                    $isInbound = $tx->isMasuk();
                    $writer->addRow(Row::fromValues([
                        $rowNumber++,
                        $tx->id,
                        $isInbound ? 'Barang Masuk' : 'Barang Keluar',
                        $this->filterService->formatIndonesianDateTime($tx->transaction_datetime),
                        $tx->item_name,
                        (float) $tx->quantity,
                        $tx->unit,
                        $tx->workType?->name ?? '-',
                        ($isInbound ? $tx->origin : $tx->destination) ?? '-',
                        ($isInbound ? $tx->sender_name : $tx->taker_name) ?? '-',
                        ($isInbound ? $tx->recipient_name : $tx->giver_name) ?? ($tx->recorder?->name ?? '-'),
                        $tx->work_description ?? '-',
                        (int) ($tx->photos_count ?? 0),
                    ]));
                }
            });

        $writer->close();

        $filename = $this->buildFilename('xlsx');

        return response()->download($xlsxPath, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ])->deleteFileAfterSend(true);
    }

    private function validateExportBounds(Builder $filteredQuery): ?JsonResponse
    {
        $totalRows = (clone $filteredQuery)->count();

        if ($totalRows === 0) {
            return response()->json([
                'message' => 'Tidak ada data transaksi yang sesuai dengan filter aktif untuk diekspor.',
            ], 422);
        }

        if ($totalRows > self::MAX_EXPORT_ROWS) {
            return response()->json([
                'message' => 'Jumlah data transaksi melebihi batas maksimal ekspor (10.000 baris). Silakan persempit filter atau rentang tanggal.',
                'total_rows' => $totalRows,
                'max_rows' => self::MAX_EXPORT_ROWS,
            ], 422);
        }

        return null;
    }

    private function formatQuantity(float $quantity): string
    {
        return rtrim(rtrim(number_format($quantity, 2, ',', '.'), '0'), ',');
    }

    private function buildFilename(string $extension): string
    {
        $timestamp = now((string) config('app.timezone', 'Asia/Jakarta'))->format('Ymd-His');

        return "laporan-transaksi-inouttrack-{$timestamp}.{$extension}";
    }
}
