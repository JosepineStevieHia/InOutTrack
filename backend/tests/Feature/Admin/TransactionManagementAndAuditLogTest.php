<?php

namespace Tests\Feature\Admin;

use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionManagementAndAuditLogTest extends TestCase
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

    private function createTransactionViaApi(User $actor, string $direction = 'in', array $overrides = []): Transaction
    {
        Sanctum::actingAs($actor);

        $workType = $overrides['work_type'] ?? WorkType::firstOrCreate(
            ['name' => 'Operasional Gudang'],
            ['description' => 'Kegiatan operasional gudang', 'is_active' => true]
        );

        $endpoint = $direction === 'in'
            ? '/api/operational/transactions/in'
            : '/api/operational/transactions/out';

        $payload = array_merge([
            'transaction_datetime' => now()->subHours(2)->format('Y-m-d\TH:i'),
            'item_name' => $direction === 'in' ? 'Kabel Listrik NYY' : 'Lampu LED 18W',
            'quantity' => 12,
            'unit' => 'Unit',
            'work_type_id' => $workType->id,
            'work_description' => 'Catatan awal transaksi.',
            'photos' => [
                $this->fakeValidPhoto('foto_awal_1.jpg', 'jpg'),
                $this->fakeValidPhoto('foto_awal_2.png', 'png'),
            ],
        ], $direction === 'in'
            ? [
                'origin' => 'Vendor Listrik Utama',
                'sender_name' => 'Pak Hendra',
            ]
            : [
                'destination' => 'Area Produksi A',
                'taker_name' => 'Ibu Rina',
            ],
            $overrides['payload'] ?? []
        );

        $response = $this->post($endpoint, $payload);
        $response->assertStatus(201);

        return Transaction::query()->findOrFail((int) $response->json('transaction.id'));
    }

    public function test_admin_can_edit_transaction_fields_and_photos_safely_with_audit_log(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create(['name' => 'Admin Audit']);
        $petugas = User::factory()->petugas()->create(['name' => 'Petugas Penerima']);

        $wtOld = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);
        $wtNew = WorkType::create(['name' => 'Instalasi', 'is_active' => true]);

        $tx = $this->createTransactionViaApi($petugas, 'in', [
            'work_type' => $wtOld,
        ]);

        $initialPhotos = $tx->photos()->orderBy('id')->get();
        $this->assertCount(2, $initialPhotos);
        $photoToDelete = $initialPhotos[0];
        $photoToKeep = $initialPhotos[1];

        Storage::disk('public')->assertExists($photoToDelete->file_path);
        Storage::disk('public')->assertExists($photoToKeep->file_path);

        Sanctum::actingAs($admin);

        // Edit via POST dengan _method=PUT (seperti pengiriman FormData multipart dari frontend)
        $response = $this->post("/api/admin/transactions/{$tx->id}", [
            '_method' => 'PUT',
            'transaction_datetime' => now()->subHour()->format('Y-m-d\TH:i'),
            'item_name' => 'Kabel Listrik NYY 4x10 (Revisi)',
            'quantity' => 24.5,
            'unit' => 'Meter',
            'work_type_id' => $wtNew->id,
            'work_description' => 'Diperbarui oleh admin beserta penggantian salah satu foto.',
            'origin' => 'PT Kabel Nusantara',
            'sender_name' => 'Pak Hendra Wijaya',
            'delete_photo_ids' => [$photoToDelete->id],
            'new_photos' => [
                $this->fakeValidPhoto('foto_baru.webp', 'webp'),
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Data transaksi berhasil diperbarui.')
            ->assertJsonPath('transaction.item_name', 'Kabel Listrik NYY 4x10 (Revisi)')
            ->assertJsonPath('transaction.work_type.name', 'Instalasi')
            ->assertJsonPath('transaction.updated_by', $admin->id)
            ->assertJsonCount(2, 'transaction.photos');

        // Verifikasi foto lama dihapus dari DB & storage, foto dipertahankan tetap ada, foto baru tersimpan
        $this->assertDatabaseMissing('transaction_photos', ['id' => $photoToDelete->id]);
        Storage::disk('public')->assertMissing($photoToDelete->file_path);
        Storage::disk('public')->assertExists($photoToKeep->file_path);

        $currentPhotos = TransactionPhoto::where('transaction_id', $tx->id)->orderBy('id')->get();
        $this->assertCount(2, $currentPhotos);
        $this->assertSame($photoToKeep->id, $currentPhotos[0]->id);
        $this->assertSame('foto_baru.webp', $currentPhotos[1]->original_name);
        Storage::disk('public')->assertExists($currentPhotos[1]->file_path);

        // Verifikasi AuditLog mencatat user, timestamp, action, old_values (termasuk foto lama) & new_values (termasuk foto baru)
        $auditLog = AuditLog::where('transaction_id', $tx->id)
            ->where('action', AuditLog::ACTION_UPDATE)
            ->first();

        $this->assertNotNull($auditLog);
        $this->assertSame($admin->id, $auditLog->user_id);
        $this->assertNotNull($auditLog->created_at);
        $this->assertSame('Kabel Listrik NYY', $auditLog->old_values['item_name']);
        $this->assertSame('Kabel Listrik NYY 4x10 (Revisi)', $auditLog->new_values['item_name']);
        $this->assertSame('Maintenance', $auditLog->old_values['work_type_name']);
        $this->assertSame('Instalasi', $auditLog->new_values['work_type_name']);
        $this->assertCount(2, $auditLog->old_values['photos']);
        $this->assertSame($photoToDelete->original_name, $auditLog->old_values['photos'][0]['original_name']);
        $this->assertCount(2, $auditLog->new_values['photos']);
        $this->assertSame('foto_baru.webp', $auditLog->new_values['photos'][1]['original_name']);
    }

    public function test_admin_edit_photo_validation_enforces_min_1_max_3_and_ownership(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create();
        $tx = $this->createTransactionViaApi($admin, 'out');
        $otherTx = $this->createTransactionViaApi($admin, 'in');

        $txPhotos = $tx->photos()->orderBy('id')->get();
        $otherPhoto = $otherTx->photos()->firstOrFail();

        Sanctum::actingAs($admin);

        // 1. Menolak penghapusan seluruh foto tanpa foto pengganti (< 1 foto)
        $this->postJson("/api/admin/transactions/{$tx->id}", [
            '_method' => 'PUT',
            'transaction_datetime' => now()->subHour()->format('Y-m-d\TH:i'),
            'item_name' => $tx->item_name,
            'quantity' => 5,
            'unit' => $tx->unit,
            'work_type_id' => $tx->work_type_id,
            'destination' => $tx->destination,
            'taker_name' => $tx->taker_name,
            'delete_photo_ids' => $txPhotos->pluck('id')->all(),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos']);

        // 2. Menolak total foto > 3 (saat ini 2, hapus 0, tambah 2 => 4 foto)
        $this->postJson("/api/admin/transactions/{$tx->id}", [
            '_method' => 'PUT',
            'transaction_datetime' => now()->subHour()->format('Y-m-d\TH:i'),
            'item_name' => $tx->item_name,
            'quantity' => 5,
            'unit' => $tx->unit,
            'work_type_id' => $tx->work_type_id,
            'destination' => $tx->destination,
            'taker_name' => $tx->taker_name,
            'new_photos' => [
                $this->fakeValidPhoto('extra_1.jpg', 'jpg'),
                $this->fakeValidPhoto('extra_2.png', 'png'),
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos']);

        // 3. Menolak delete_photo_ids milik transaksi lain
        $this->postJson("/api/admin/transactions/{$tx->id}", [
            '_method' => 'PUT',
            'transaction_datetime' => now()->subHour()->format('Y-m-d\TH:i'),
            'item_name' => $tx->item_name,
            'quantity' => 5,
            'unit' => $tx->unit,
            'work_type_id' => $tx->work_type_id,
            'destination' => $tx->destination,
            'taker_name' => $tx->taker_name,
            'delete_photo_ids' => [$otherPhoto->id],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['delete_photo_ids']);

        // Pastikan tidak ada foto asli yang hilang setelah validasi gagal
        $this->assertCount(2, TransactionPhoto::where('transaction_id', $tx->id)->get());
        $this->assertSame(0, AuditLog::where('transaction_id', $tx->id)->count());
    }

    public function test_admin_soft_delete_preserves_database_row_and_records_audit_log(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create(['name' => 'Admin Penghapus']);
        $petugas = User::factory()->petugas()->create(['name' => 'Petugas Security']);

        $tx = $this->createTransactionViaApi($petugas, 'out', [
            'payload' => [
                'item_name' => 'Genset Portable Honda',
                'quantity' => 1,
                'unit' => 'Unit',
                'destination' => 'Lokasi Proyek Timur',
                'taker_name' => 'Budi Santoso',
            ],
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/admin/transactions/{$tx->id}")
            ->assertStatus(200)
            ->assertJsonPath('message', 'Transaksi berhasil dihapus.');

        // Data tetap ada di DB dengan deleted_at terisi (soft delete, bukan permanent delete)
        $this->assertSoftDeleted('transactions', ['id' => $tx->id]);
        $trashed = Transaction::withTrashed()->find($tx->id);
        $this->assertNotNull($trashed);
        $this->assertNotNull($trashed->deleted_at);
        $this->assertSame($admin->id, $trashed->updated_by);

        // Tidak muncul pada riwayat aktif maupun dashboard
        $this->getJson('/api/operational/transactions')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 0);

        $this->getJson('/api/operational/dashboard')
            ->assertStatus(200)
            ->assertJsonPath('summary.total', 0);

        // Tercatat pada AuditLog dengan ACTION_DELETE dan snapshot lengkap
        $deleteLog = AuditLog::where('transaction_id', $tx->id)
            ->where('action', AuditLog::ACTION_DELETE)
            ->first();

        $this->assertNotNull($deleteLog);
        $this->assertSame($admin->id, $deleteLog->user_id);
        $this->assertSame('Genset Portable Honda', $deleteLog->old_values['item_name']);
        $this->assertCount(2, $deleteLog->old_values['photos']);
        $this->assertNull($deleteLog->new_values);
    }

    public function test_admin_can_list_filter_and_view_audit_log_details_including_soft_deleted_transactions(): void
    {
        Storage::fake('public');

        $adminOne = User::factory()->admin()->create(['name' => 'Admin Pertama', 'username' => 'admin_satu']);
        $adminTwo = User::factory()->admin()->create(['name' => 'Admin Kedua', 'username' => 'admin_dua']);
        $wt = WorkType::create(['name' => 'Maintenance Mesin', 'is_active' => true]);

        $tx1 = $this->createTransactionViaApi($adminOne, 'in', [
            'work_type' => $wt,
            'payload' => ['item_name' => 'Bearing SKF 6205'],
        ]);
        $tx2 = $this->createTransactionViaApi($adminTwo, 'out', [
            'work_type' => $wt,
            'payload' => ['item_name' => 'Motor Pompa 2HP'],
        ]);

        // Admin 1 edit tx1
        Sanctum::actingAs($adminOne);
        $this->putJson("/api/admin/transactions/{$tx1->id}", [
            'transaction_datetime' => now()->subMinutes(30)->format('Y-m-d\TH:i'),
            'item_name' => 'Bearing SKF 6205 ZZ',
            'quantity' => 20,
            'unit' => 'Pcs',
            'work_type_id' => $wt->id,
            'origin' => 'Vendor Bearing',
            'sender_name' => 'Kurir',
        ])->assertStatus(200);

        // Admin 2 soft delete tx2
        Sanctum::actingAs($adminTwo);
        $this->deleteJson("/api/admin/transactions/{$tx2->id}")->assertStatus(200);

        // Daftar log audit tanpa filter
        $listRes = $this->getJson('/api/admin/audit-logs');
        $listRes->assertStatus(200)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.update_count', 1)
            ->assertJsonPath('summary.delete_count', 1)
            ->assertJsonCount(2, 'data');

        // Filter action=DELETE + search nama barang transaksi yang sudah di-soft-delete
        $deleteFilterRes = $this->getJson('/api/admin/audit-logs?action=DELETE&search=Motor%20Pompa');
        $deleteFilterRes->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.action', AuditLog::ACTION_DELETE)
            ->assertJsonPath('data.0.user.username', 'admin_dua')
            ->assertJsonPath('data.0.transaction.id', $tx2->id)
            ->assertJsonPath('data.0.transaction.is_deleted', true);

        // Filter user_id=adminOne
        $userFilterRes = $this->getJson('/api/admin/audit-logs?user_id=' . $adminOne->id);
        $userFilterRes->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.action', AuditLog::ACTION_UPDATE)
            ->assertJsonPath('data.0.transaction.item_name', 'Bearing SKF 6205 ZZ')
            ->assertJsonPath('data.0.transaction.is_deleted', false);

        // Detail audit log UPDATE memeriksa changed_fields & old/new values
        $updateLogId = (int) $userFilterRes->json('data.0.id');
        $detailRes = $this->getJson("/api/admin/audit-logs/{$updateLogId}");
        $detailRes->assertStatus(200)
            ->assertJsonPath('audit_log.id', $updateLogId)
            ->assertJsonPath('audit_log.old_values.item_name', 'Bearing SKF 6205')
            ->assertJsonPath('audit_log.new_values.item_name', 'Bearing SKF 6205 ZZ');

        $changedFields = $detailRes->json('audit_log.changed_fields');
        $this->assertContains('item_name', $changedFields);
        $this->assertContains('quantity', $changedFields);
    }

    public function test_petugas_cannot_edit_delete_view_or_modify_audit_logs_and_audit_logs_are_immutable(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create();
        $petugas = User::factory()->petugas()->create();
        $wt = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);

        $tx = $this->createTransactionViaApi($petugas, 'in', ['work_type' => $wt]);

        // Buat 1 audit log oleh Admin
        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/transactions/{$tx->id}", [
            'transaction_datetime' => now()->subMinutes(15)->format('Y-m-d\TH:i'),
            'item_name' => 'Diubah Admin',
            'quantity' => 15,
            'unit' => 'Unit',
            'work_type_id' => $wt->id,
            'origin' => 'Vendor A',
            'sender_name' => 'Kurir A',
        ])->assertStatus(200);

        $auditLog = AuditLog::query()->firstOrFail();

        // Guest mendapat 401
        auth()->forgetGuards();
        $this->getJson('/api/admin/audit-logs')->assertStatus(401);
        $this->getJson("/api/admin/audit-logs/{$auditLog->id}")->assertStatus(401);

        // Petugas ditolak 403 untuk edit, delete, maupun melihat audit log
        Sanctum::actingAs($petugas);

        $this->putJson("/api/admin/transactions/{$tx->id}", [
            'transaction_datetime' => now()->subMinutes(10)->format('Y-m-d\TH:i'),
            'item_name' => 'Percobaan Petugas',
            'quantity' => 99,
            'unit' => 'Unit',
            'work_type_id' => $wt->id,
            'origin' => 'Vendor X',
            'sender_name' => 'Kurir X',
        ])->assertStatus(403);

        $this->postJson("/api/admin/transactions/{$tx->id}", [
            '_method' => 'PUT',
            'item_name' => 'Percobaan Multipart Petugas',
        ])->assertStatus(403);

        $this->deleteJson("/api/admin/transactions/{$tx->id}")->assertStatus(403);
        $this->getJson('/api/admin/audit-logs')->assertStatus(403);
        $this->getJson("/api/admin/audit-logs/{$auditLog->id}")->assertStatus(403);

        // Tidak ada endpoint untuk mengubah atau menghapus log audit (405 Method Not Allowed)
        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/audit-logs', [])->assertStatus(405);
        $this->putJson("/api/admin/audit-logs/{$auditLog->id}", [])->assertStatus(405);
        $this->patchJson("/api/admin/audit-logs/{$auditLog->id}", [])->assertStatus(405);
        $this->deleteJson("/api/admin/audit-logs/{$auditLog->id}")->assertStatus(405);
    }
}
