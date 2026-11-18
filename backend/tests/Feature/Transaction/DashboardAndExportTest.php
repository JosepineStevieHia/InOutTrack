<?php

namespace Tests\Feature\Transaction;

use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use Tests\TestCase;

class DashboardAndExportTest extends TestCase
{
    use RefreshDatabase;

    private function seedTransaction(array $overrides = []): Transaction
    {
        $recorder = $overrides['recorder'] ?? User::factory()->petugas()->create();
        unset($overrides['recorder']);

        $workType = $overrides['work_type'] ?? WorkType::first() ?? WorkType::create([
            'name' => 'Produksi',
            'is_active' => true,
        ]);
        unset($overrides['work_type']);

        $type = $overrides['type'] ?? Transaction::TYPE_MASUK;
        $isInbound = $type === Transaction::TYPE_MASUK;

        $defaults = [
            'type' => $type,
            'transaction_datetime' => now()->subHours(2),
            'item_name' => 'Kompresor Industri',
            'quantity' => 2,
            'unit' => 'Unit',
            'work_type_id' => $workType->id,
            'work_description' => 'Pengadaan unit produksi',
            'origin' => $isInbound ? 'PT Sumber Mesin' : null,
            'destination' => $isInbound ? null : 'Area Assembly A',
            'sender_name' => $isInbound ? 'Budi Ekspedisi' : null,
            'recipient_name' => $isInbound ? $recorder->name : null,
            'taker_name' => $isInbound ? null : 'Agus Teknisi',
            'giver_name' => $isInbound ? null : $recorder->name,
            'recorded_by' => $recorder->id,
            'created_by' => $recorder->id,
            'updated_by' => null,
        ];

        return Transaction::create(array_merge($defaults, $overrides));
    }

    /**
     * Ekstrak seluruh teks yang dapat dibaca dari stream terkompresi di dalam file PDF biner.
     */
    private function extractPdfText(string $pdfBytes): string
    {
        $output = $pdfBytes;

        if (preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $pdfBytes, $matches)) {
            foreach ($matches[1] as $streamData) {
                $decoded = @gzuncompress($streamData);
                if (is_string($decoded)) {
                    $output .= "\n" . $decoded;
                }
            }
        }

        return $output;
    }

    public function test_dashboard_summary_returns_filtered_period_totals_and_recent_transactions(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Staf Admin']);
        $petugas = User::factory()->petugas()->create(['name' => 'Petugas Store']);
        $workType = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);

        // Dalam periode 10-15 Nov 2026: 2 MASUK, 1 KELUAR
        $this->seedTransaction([
            'recorder' => $petugas,
            'work_type' => $workType,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-11 09:00:00',
            'item_name' => 'Filter Oli Mesin A',
        ]);
        $this->seedTransaction([
            'recorder' => $petugas,
            'work_type' => $workType,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-14 10:00:00',
            'item_name' => 'Kabel Sensor Servo',
        ]);
        $this->seedTransaction([
            'recorder' => $petugas,
            'work_type' => $workType,
            'type' => Transaction::TYPE_KELUAR,
            'transaction_datetime' => '2026-11-15 15:30:00',
            'item_name' => 'Sabuk Konveyor',
        ]);

        // Di luar periode (01 Nov 2026)
        $this->seedTransaction([
            'recorder' => $admin,
            'work_type' => $workType,
            'type' => Transaction::TYPE_KELUAR,
            'transaction_datetime' => '2026-11-01 08:00:00',
            'item_name' => 'Barang Periode Lama',
        ]);

        Sanctum::actingAs($petugas);

        // Tanpa filter periode -> semua 4 transaksi
        $this->getJson('/api/operational/dashboard')
            ->assertStatus(200)
            ->assertJsonPath('summary.total', 4)
            ->assertJsonPath('summary.masuk', 2)
            ->assertJsonPath('summary.keluar', 2)
            ->assertJsonPath('period.label', 'Semua Periode')
            ->assertJsonCount(4, 'recent_transactions');

        // Dengan filter periode 10-15 Nov 2026 -> 3 transaksi (2 MASUK, 1 KELUAR)
        $this->getJson('/api/operational/dashboard?date_from=2026-11-10&date_to=2026-11-15')
            ->assertStatus(200)
            ->assertJsonPath('summary.total', 3)
            ->assertJsonPath('summary.masuk', 2)
            ->assertJsonPath('summary.keluar', 1)
            ->assertJsonPath('period.label', '10 Nov 2026 s.d. 15 Nov 2026')
            ->assertJsonCount(3, 'recent_transactions')
            ->assertJsonPath('recent_transactions.0.item_name', 'Sabuk Konveyor');
    }

    public function test_unauthenticated_and_petugas_cannot_call_export_endpoints(): void
    {
        $this->getJson('/api/admin/transactions/export/pdf')->assertStatus(401);
        $this->getJson('/api/admin/transactions/export/excel')->assertStatus(401);

        $petugas = User::factory()->petugas()->create();
        $this->seedTransaction(['recorder' => $petugas]);

        Sanctum::actingAs($petugas);

        $this->getJson('/api/admin/transactions/export/pdf')->assertStatus(403);
        $this->getJson('/api/admin/transactions/export/excel')->assertStatus(403);
    }

    public function test_export_rejects_empty_result_set_without_producing_empty_file(): void
    {
        $admin = User::factory()->admin()->create();
        $this->seedTransaction(['recorder' => $admin, 'item_name' => 'Bearing SKF']);

        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/transactions/export/pdf?search=KataKunciTidakCocok999')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Tidak ada data transaksi yang sesuai dengan filter aktif untuk diekspor.');

        $this->getJson('/api/admin/transactions/export/excel?search=KataKunciTidakCocok999')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Tidak ada data transaksi yang sesuai dengan filter aktif untuk diekspor.');
    }

    public function test_export_rejects_when_matching_rows_exceed_10000_limit(): void
    {
        $admin = User::factory()->admin()->create();
        $workType = WorkType::create(['name' => 'Mass Test', 'is_active' => true]);

        $nowStr = now()->subMinutes(10)->format('Y-m-d H:i:s');
        $batch = [];
        for ($i = 1; $i <= 10001; $i++) {
            $batch[] = [
                'type' => Transaction::TYPE_MASUK,
                'transaction_datetime' => $nowStr,
                'item_name' => 'Mass Item #' . $i,
                'quantity' => 1,
                'unit' => 'Pcs',
                'work_type_id' => $workType->id,
                'work_description' => null,
                'origin' => 'Gudang Pusat',
                'destination' => null,
                'sender_name' => 'Kurir',
                'recipient_name' => $admin->name,
                'taker_name' => null,
                'giver_name' => null,
                'recorded_by' => $admin->id,
                'created_by' => $admin->id,
                'updated_by' => null,
                'created_at' => $nowStr,
                'updated_at' => $nowStr,
            ];

            if (count($batch) === 1000) {
                DB::table('transactions')->insert($batch);
                $batch = [];
            }
        }
        if ($batch !== []) {
            DB::table('transactions')->insert($batch);
        }

        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/transactions/export/pdf')
            ->assertStatus(422)
            ->assertJsonPath('total_rows', 10001)
            ->assertJsonPath('max_rows', 10000);

        $this->getJson('/api/admin/transactions/export/excel')
            ->assertStatus(422)
            ->assertJsonPath('total_rows', 10001)
            ->assertJsonPath('max_rows', 10000);
    }

    public function test_admin_can_export_filtered_transactions_to_valid_pdf_and_xlsx(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Admin Pelapor']);
        $petugas = User::factory()->petugas()->create(['name' => 'Petugas Gudang']);
        $wtMaint = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);
        $wtProd = WorkType::create(['name' => 'Produksi', 'is_active' => true]);

        $matchingTx = $this->seedTransaction([
            'recorder' => $petugas,
            'work_type' => $wtMaint,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-12 11:20:00',
            'item_name' => 'Servo Motor Mitsubishi',
            'quantity' => 4,
            'unit' => 'Unit',
            'origin' => 'PT Otomasi Jaya',
            'sender_name' => 'Rudi Kurir',
            'work_description' => 'Suku cadang mesin CNC',
        ]);

        TransactionPhoto::create([
            'transaction_id' => $matchingTx->id,
            'file_path' => 'transactions/sample/servo.jpg',
            'original_name' => 'servo.jpg',
            'mime_type' => 'image/jpeg',
            'file_size' => 12345,
        ]);

        // Transaksi pembanding di luar filter (jenis KELUAR dan jenis pekerjaan berbeda)
        $this->seedTransaction([
            'recorder' => $admin,
            'work_type' => $wtProd,
            'type' => Transaction::TYPE_KELUAR,
            'transaction_datetime' => '2026-11-12 14:00:00',
            'item_name' => 'Barang Tidak Terfilter',
            'destination' => 'Line Assembly 2',
        ]);

        Sanctum::actingAs($admin);

        $filterQuery = http_build_query([
            'search' => 'Servo Motor',
            'type' => 'MASUK',
            'recorded_by' => $petugas->id,
            'work_type_id' => $wtMaint->id,
            'date_from' => '2026-11-10',
            'date_to' => '2026-11-15',
        ]);

        // 1. Uji Ekspor PDF
        $pdfResponse = $this->get('/api/admin/transactions/export/pdf?' . $filterQuery);
        $pdfResponse->assertStatus(200);
        $this->assertStringContainsString('application/pdf', (string) $pdfResponse->headers->get('Content-Type'));
        $this->assertStringContainsString('.pdf', (string) $pdfResponse->headers->get('Content-Disposition'));

        $pdfBytes = $pdfResponse->getContent();
        $this->assertNotFalse($pdfBytes);
        $this->assertStringStartsWith('%PDF-', $pdfBytes);
        $this->assertGreaterThan(1000, strlen($pdfBytes));

        $extractedPdfText = $this->extractPdfText($pdfBytes);
        $this->assertStringContainsString('10 Nov 2026 s.d. 15 Nov 2026', $extractedPdfText);
        $this->assertStringContainsString('Servo Motor Mitsubishi', $extractedPdfText);
        $this->assertStringNotContainsString('Barang Tidak Terfilter', $extractedPdfText);

        // 2. Uji Ekspor Excel (.xlsx) & verifikasi isi workbook menggunakan OpenSpout Reader
        $xlsxResponse = $this->get('/api/admin/transactions/export/excel?' . $filterQuery);
        $xlsxResponse->assertStatus(200);
        $this->assertStringContainsString(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            (string) $xlsxResponse->headers->get('Content-Type')
        );
        $this->assertStringContainsString('.xlsx', (string) $xlsxResponse->headers->get('Content-Disposition'));

        $baseResponse = $xlsxResponse->baseResponse;
        $xlsxPath = $baseResponse->getFile()->getPathname();
        $this->assertFileExists($xlsxPath);

        $rawHeader = file_get_contents($xlsxPath, false, null, 0, 2);
        $this->assertSame('PK', $rawHeader);

        $reader = new XlsxReader();
        $reader->open($xlsxPath);

        $rows = [];
        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                $rows[] = $row->toArray();
            }
            break;
        }
        $reader->close();
        @unlink($xlsxPath);

        $flattenedText = collect($rows)
            ->flatten()
            ->map(fn ($v) => (string) $v)
            ->implode(' | ');

        $this->assertStringContainsString('10 Nov 2026 s.d. 15 Nov 2026', $flattenedText);
        $this->assertStringContainsString('Jenis Transaksi', $flattenedText);
        $this->assertStringContainsString('Nama Barang', $flattenedText);
        $this->assertStringContainsString('Servo Motor Mitsubishi', $flattenedText);
        $this->assertStringContainsString('PT Otomasi Jaya', $flattenedText);
        $this->assertStringNotContainsString('Barang Tidak Terfilter', $flattenedText);

        // OpenSpout Reader mengabaikan baris kosong pemisah secara default:
        // rows[0..4] = metadata & periode, rows[5] = header kolom, rows[6] = 1 baris data
        $this->assertCount(7, $rows);
        $this->assertSame('Jenis Transaksi', $rows[5][2]);
        $this->assertSame('Servo Motor Mitsubishi', $rows[6][4]);
        $this->assertSame(1, $rows[6][12]); // photos_count = 1
    }
}
