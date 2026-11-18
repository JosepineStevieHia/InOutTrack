<?php

namespace Tests\Feature\QA;

use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use Tests\TestCase;

class QualityAssuranceAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    private function fakeValidPhoto(string $name, string $format = 'jpg'): UploadedFile
    {
        $bytes = match ($format) {
            'png' => base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
            'webp' => base64_decode('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='),
            default => base64_decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='),
        };

        return UploadedFile::fake()->createWithContent($name, $bytes);
    }

    public function test_unauthenticated_non_json_requests_return_401_without_route_login_error(): void
    {
        // Akses langsung URL API tanpa Accept: application/json tidak boleh memicu Route [login] not defined (500)
        $this->get('/api/auth/me')
            ->assertStatus(401)
            ->assertJsonStructure(['message']);

        $this->get('/api/admin/transactions/export/pdf')
            ->assertStatus(401)
            ->assertJsonStructure(['message']);
    }

    public function test_cors_and_sanctum_csrf_headers_are_configured_for_frontend_origin(): void
    {
        Storage::fake('public');

        // Preflight OPTIONS dari http://localhost:3000
        $preflight = $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'Content-Type, X-XSRF-TOKEN',
        ])->options('/api/auth/login');

        $preflight->assertStatus(204);
        $this->assertSame('http://localhost:3000', $preflight->headers->get('Access-Control-Allow-Origin'));
        $this->assertSame('true', $preflight->headers->get('Access-Control-Allow-Credentials'));

        // CSRF cookie
        $csrfResponse = $this->withHeaders([
            'Origin' => 'http://localhost:3000',
        ])->get('/sanctum/csrf-cookie');

        $csrfResponse->assertStatus(204);
        $csrfResponse->assertCookie('XSRF-TOKEN');
        $this->assertSame('http://localhost:3000', $csrfResponse->headers->get('Access-Control-Allow-Origin'));

        // Expose Content-Disposition pada endpoint export
        $admin = User::factory()->admin()->create();
        $wt = WorkType::create(['name' => 'Produksi', 'is_active' => true]);
        Transaction::create([
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => now()->subHour(),
            'item_name' => 'Panel Kontrol',
            'quantity' => 2,
            'unit' => 'Unit',
            'work_type_id' => $wt->id,
            'origin' => 'Vendor',
            'sender_name' => 'Kurir',
            'recipient_name' => $admin->name,
            'recorded_by' => $admin->id,
            'created_by' => $admin->id,
        ]);

        Sanctum::actingAs($admin);
        $exportResponse = $this->withHeaders([
            'Origin' => 'http://localhost:3000',
        ])->get('/api/admin/transactions/export/pdf');

        $exportResponse->assertStatus(200);
        $this->assertSame('http://localhost:3000', $exportResponse->headers->get('Access-Control-Allow-Origin'));
        $this->assertStringContainsString(
            'Content-Disposition',
            (string) $exportResponse->headers->get('Access-Control-Expose-Headers')
        );
    }

    public function test_file_upload_security_rejects_malicious_files_oversized_and_sanitizes_traversal_names(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create();
        $wt = WorkType::create(['name' => 'Pemeliharaan', 'is_active' => true]);

        Sanctum::actingAs($petugas);

        // 1. Tolak file PHP / SVG / HTML / JPG palsu
        $phpShell = UploadedFile::fake()->createWithContent('shell.php', '<?php system($_GET["c"]); ?>');
        $svgXss = UploadedFile::fake()->createWithContent('xss.svg', '<svg onload="alert(1)"></svg>');
        $fakeJpg = UploadedFile::fake()->createWithContent('fake.jpg', '<?php echo "evil"; ?>');

        foreach ([$phpShell, $svgXss, $fakeJpg] as $badFile) {
            $this->postJson('/api/operational/transactions/in', [
                'transaction_datetime' => now()->subMinutes(10)->format('Y-m-d\TH:i'),
                'item_name' => 'Barang Uji Keamanan',
                'quantity' => 1,
                'unit' => 'Unit',
                'work_type_id' => $wt->id,
                'origin' => 'Supplier',
                'sender_name' => 'Kurir',
                'photos' => [$badFile],
            ])->assertStatus(422)
                ->assertJsonValidationErrors(['photos.0']);
        }

        // 2. Tolak > 5 MB & > 3 file
        $oversizedBytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
            . str_repeat('A', 5200 * 1024);
        $oversized = UploadedFile::fake()->createWithContent('besar.png', $oversizedBytes);

        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subMinutes(10)->format('Y-m-d\TH:i'),
            'item_name' => 'Barang Oversize',
            'quantity' => 1,
            'unit' => 'Unit',
            'work_type_id' => $wt->id,
            'origin' => 'Supplier',
            'sender_name' => 'Kurir',
            'photos' => [$oversized],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos.0']);

        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subMinutes(10)->format('Y-m-d\TH:i'),
            'item_name' => 'Barang Lebih 3 Foto',
            'quantity' => 1,
            'unit' => 'Unit',
            'work_type_id' => $wt->id,
            'origin' => 'Supplier',
            'sender_name' => 'Kurir',
            'photos' => [
                $this->fakeValidPhoto('1.jpg'),
                $this->fakeValidPhoto('2.jpg'),
                $this->fakeValidPhoto('3.jpg'),
                $this->fakeValidPhoto('4.jpg'),
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos']);

        // 3. Sanitasi path traversal pada nama file asli
        $traversalFile = $this->fakeValidPhoto('../../evil/payload.jpg', 'jpg');
        $res = $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subMinutes(10)->format('Y-m-d\TH:i'),
            'item_name' => 'Barang Sanitasi Nama',
            'quantity' => 1,
            'unit' => 'Unit',
            'work_type_id' => $wt->id,
            'origin' => 'Supplier',
            'sender_name' => 'Kurir',
            'photos' => [$traversalFile],
        ]);

        $res->assertStatus(201);
        $photo = TransactionPhoto::query()->firstOrFail();
        $this->assertStringNotContainsString('..', $photo->original_name);
        $this->assertStringNotContainsString('/', $photo->original_name);
        $this->assertStringStartsWith('transaction-photos/', $photo->file_path);
        Storage::disk('public')->assertExists($photo->file_path);
    }

    public function test_transaction_datetime_validation_differs_between_petugas_and_admin(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create();
        $petugas = User::factory()->petugas()->create();
        $wt = WorkType::create(['name' => 'Logistik', 'is_active' => true]);

        // Petugas dibatasi mundur maks 24 jam dan tidak boleh masa depan (PRD Bagian 6)
        Sanctum::actingAs($petugas);

        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subHours(25)->format('Y-m-d\TH:i'),
            'item_name' => 'Kabel Mundur 25 Jam',
            'quantity' => 2,
            'unit' => 'Roll',
            'work_type_id' => $wt->id,
            'origin' => 'Gudang',
            'sender_name' => 'Kurir',
            'photos' => [$this->fakeValidPhoto('a.jpg')],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_datetime']);

        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->addHour()->format('Y-m-d\TH:i'),
            'item_name' => 'Kabel Masa Depan',
            'quantity' => 2,
            'unit' => 'Roll',
            'work_type_id' => $wt->id,
            'origin' => 'Gudang',
            'sender_name' => 'Kurir',
            'photos' => [$this->fakeValidPhoto('b.jpg')],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_datetime']);

        // Admin boleh mencatat mundur > 24 jam, tetapi tetap ditolak bila masa depan
        Sanctum::actingAs($admin);

        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subHours(48)->format('Y-m-d\TH:i'),
            'item_name' => 'Kabel Backdate Admin 48 Jam',
            'quantity' => 2,
            'unit' => 'Roll',
            'work_type_id' => $wt->id,
            'origin' => 'Gudang',
            'sender_name' => 'Kurir',
            'photos' => [$this->fakeValidPhoto('c.jpg')],
        ])->assertStatus(201);

        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->addHour()->format('Y-m-d\TH:i'),
            'item_name' => 'Kabel Masa Depan Admin',
            'quantity' => 2,
            'unit' => 'Roll',
            'work_type_id' => $wt->id,
            'origin' => 'Gudang',
            'sender_name' => 'Kurir',
            'photos' => [$this->fakeValidPhoto('d.jpg')],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_datetime']);
    }

    public function test_full_prd_lifecycle_consistency_from_user_creation_to_soft_delete_and_audit(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create(['name' => 'Admin Utama']);

        // 1. Admin membuat akun Petugas baru dan Jenis Pekerjaan baru
        Sanctum::actingAs($admin);

        $createUserRes = $this->postJson('/api/admin/users', [
            'name' => 'Petugas Lapangan QA',
            'username' => 'petugas.qa',
            'email' => 'qa.petugas@inouttrack.local',
            'password' => 'Rahasia123!',
            'role' => User::ROLE_PETUGAS,
            'is_active' => true,
        ]);
        $createUserRes->assertStatus(201);
        $petugasId = (int) $createUserRes->json('user.id');

        $createWtRes = $this->postJson('/api/admin/work-types', [
            'name' => 'Overhaul Mesin QA',
            'description' => 'Perbaikan menyeluruh mesin produksi',
            'is_active' => true,
        ]);
        $createWtRes->assertStatus(201);
        $workTypeId = (int) $createWtRes->json('work_type.id');

        // 2. Petugas login nyata dan mencatat Barang Masuk + Barang Keluar (uji anti-spoofing nama)
        auth()->forgetGuards();
        $this->postJson('/api/auth/login', [
            'login' => 'petugas.qa',
            'password' => 'Rahasia123!',
        ])->assertStatus(200);

        $inRes = $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subHours(2)->format('Y-m-d\TH:i'),
            'item_name' => 'Motor Servo Siemens',
            'quantity' => 3.5,
            'unit' => 'Unit',
            'work_type_id' => $workTypeId,
            'work_description' => 'Barang tiba untuk overhaul.',
            'origin' => 'PT Otomasi Prima',
            'sender_name' => 'Kurir Ekspedisi',
            'recipient_name' => 'NAMA SPOOF PALSU',
            'recorded_by' => $admin->id,
            'photos' => [$this->fakeValidPhoto('servo_in.jpg')],
        ]);
        $inRes->assertStatus(201)
            ->assertJsonPath('transaction.recipient_name', 'Petugas Lapangan QA')
            ->assertJsonPath('transaction.recorded_by', $petugasId);
        $inTxId = (int) $inRes->json('transaction.id');

        $outRes = $this->postJson('/api/operational/transactions/out', [
            'transaction_datetime' => now()->subHour()->format('Y-m-d\TH:i'),
            'item_name' => 'Bearing SKF 6308',
            'quantity' => 10,
            'unit' => 'Pcs',
            'work_type_id' => $workTypeId,
            'destination' => 'Line Assembly 2',
            'taker_name' => 'Teknisi Budi',
            'giver_name' => 'NAMA SPOOF PALSU',
            'photos' => [$this->fakeValidPhoto('bearing_out.png', 'png')],
        ]);
        $outRes->assertStatus(201)
            ->assertJsonPath('transaction.giver_name', 'Petugas Lapangan QA')
            ->assertJsonPath('transaction.recorded_by', $petugasId);
        $outTxId = (int) $outRes->json('transaction.id');

        // 3. Cek Dashboard & Riwayat Gabungan
        $this->getJson('/api/operational/dashboard')
            ->assertStatus(200)
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.masuk', 1)
            ->assertJsonPath('summary.keluar', 1);

        $this->getJson('/api/operational/transactions')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $outTxId)
            ->assertJsonPath('data.1.id', $inTxId);

        // 4. Admin menonaktifkan akun Petugas & Jenis Pekerjaan -> data historis tetap konsisten!
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$petugasId}/status", ['is_active' => false])->assertStatus(200);
        $this->patchJson("/api/admin/work-types/{$workTypeId}/status", ['is_active' => false])->assertStatus(200);

        // Akun nonaktif ditolak 403 saat login
        auth()->forgetGuards();
        $this->postJson('/api/auth/login', [
            'login' => 'petugas.qa',
            'password' => 'Rahasia123!',
        ])->assertStatus(403);

        // Kembali sebagai Admin: WorkType nonaktif tidak tersedia di pilihan form baru, tapi transaksi lama tetap utuh
        Sanctum::actingAs($admin);
        $this->getJson('/api/operational/work-types')
            ->assertStatus(200)
            ->assertJsonCount(0, 'data');

        $this->getJson("/api/operational/transactions/{$inTxId}")
            ->assertStatus(200)
            ->assertJsonPath('transaction.recorder.name', 'Petugas Lapangan QA')
            ->assertJsonPath('transaction.work_type.name', 'Overhaul Mesin QA');

        // 5. Admin mengedit Barang Masuk (+ ganti foto), ekspor PDF & Excel, lalu soft-delete Barang Keluar
        $oldPhotoId = (int) $inRes->json('transaction.photos.0.id');
        $this->post("/api/admin/transactions/{$inTxId}", [
            '_method' => 'PUT',
            'transaction_datetime' => now()->subMinutes(90)->format('Y-m-d\TH:i'),
            'item_name' => 'Motor Servo Siemens (Verified)',
            'quantity' => 4,
            'unit' => 'Unit',
            'work_type_id' => $workTypeId,
            'origin' => 'PT Otomasi Prima',
            'sender_name' => 'Kurir Ekspedisi',
            'delete_photo_ids' => [$oldPhotoId],
            'new_photos' => [$this->fakeValidPhoto('servo_revisi.webp', 'webp')],
        ])->assertStatus(200)
            ->assertJsonPath('transaction.item_name', 'Motor Servo Siemens (Verified)');

        // Ekspor PDF
        $pdfRes = $this->get('/api/admin/transactions/export/pdf');
        $pdfRes->assertStatus(200);
        $this->assertStringStartsWith('%PDF-', $pdfRes->getContent());

        // Ekspor Excel
        $xlsxRes = $this->get('/api/admin/transactions/export/excel');
        $xlsxRes->assertStatus(200);
        $tmpXlsx = tempnam(sys_get_temp_dir(), 'qa_xlsx_');
        file_put_contents($tmpXlsx, $xlsxRes->streamedContent());
        $reader = new XlsxReader();
        $reader->open($tmpXlsx);
        $sheetRows = 0;
        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $_row) {
                $sheetRows++;
            }
        }
        $reader->close();
        @unlink($tmpXlsx);
        $this->assertGreaterThanOrEqual(4, $sheetRows);

        // Soft delete transaksi keluar
        $this->deleteJson("/api/admin/transactions/{$outTxId}")->assertStatus(200);
        $this->assertSoftDeleted('transactions', ['id' => $outTxId]);

        $this->getJson('/api/operational/dashboard')
            ->assertStatus(200)
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.masuk', 1)
            ->assertJsonPath('summary.keluar', 0);

        // Audit logs merekam UPDATE dan DELETE secara lengkap
        $this->getJson('/api/admin/audit-logs')
            ->assertStatus(200)
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.update_count', 1)
            ->assertJsonPath('summary.delete_count', 1);

        // Akun petugas yang sudah terhubung transaksi tidak boleh dapat dihapus permanen (PRD Bagian 6)
        $this->deleteJson("/api/admin/users/{$petugasId}")->assertStatus(422);
    }

    public function test_complete_endpoint_security_matrix_for_guest_and_petugas(): void
    {
        $admin = User::factory()->admin()->create();
        $petugas = User::factory()->petugas()->create();
        $wt = WorkType::create(['name' => 'Umum', 'is_active' => true]);

        $tx = Transaction::create([
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => now()->subHour(),
            'item_name' => 'Item Matrix',
            'quantity' => 1,
            'unit' => 'Unit',
            'work_type_id' => $wt->id,
            'origin' => 'Vendor',
            'sender_name' => 'Kurir',
            'recipient_name' => $petugas->name,
            'recorded_by' => $petugas->id,
            'created_by' => $petugas->id,
        ]);

        $audit = AuditLog::create([
            'user_id' => $admin->id,
            'transaction_id' => $tx->id,
            'action' => AuditLog::ACTION_UPDATE,
            'old_values' => ['item_name' => 'Item Matrix'],
            'new_values' => ['item_name' => 'Item Matrix'],
            'description' => 'Test matrix',
            'created_at' => now(),
        ]);

        $adminMatrix = [
            ['GET', '/api/admin/access-check'],
            ['GET', '/api/admin/users'],
            ['POST', '/api/admin/users'],
            ['GET', "/api/admin/users/{$petugas->id}"],
            ['PUT', "/api/admin/users/{$petugas->id}"],
            ['PATCH', "/api/admin/users/{$petugas->id}/status"],
            ['DELETE', "/api/admin/users/{$petugas->id}"],
            ['GET', '/api/admin/work-types'],
            ['POST', '/api/admin/work-types'],
            ['GET', "/api/admin/work-types/{$wt->id}"],
            ['PUT', "/api/admin/work-types/{$wt->id}"],
            ['PATCH', "/api/admin/work-types/{$wt->id}/status"],
            ['PUT', "/api/admin/transactions/{$tx->id}"],
            ['POST', "/api/admin/transactions/{$tx->id}"],
            ['DELETE', "/api/admin/transactions/{$tx->id}"],
            ['GET', '/api/admin/transactions/export/pdf'],
            ['GET', '/api/admin/transactions/export/excel'],
            ['GET', '/api/admin/audit-logs'],
            ['GET', "/api/admin/audit-logs/{$audit->id}"],
        ];

        // 1. Guest harus ditolak 401 di semua endpoint Admin
        auth()->forgetGuards();
        foreach ($adminMatrix as [$method, $uri]) {
            $this->json($method, $uri)->assertStatus(401);
        }

        // 2. Petugas harus ditolak 403 di semua endpoint Admin
        Sanctum::actingAs($petugas);
        foreach ($adminMatrix as [$method, $uri]) {
            $this->json($method, $uri)->assertStatus(403);
        }
    }
}
