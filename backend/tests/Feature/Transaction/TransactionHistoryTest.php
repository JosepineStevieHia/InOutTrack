<?php

namespace Tests\Feature\Transaction;

use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionHistoryTest extends TestCase
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
            'item_name' => 'Kabel Listrik NYM 3x2.5',
            'quantity' => 10,
            'unit' => 'Roll',
            'work_type_id' => $workType->id,
            'work_description' => 'Stok gudang utama',
            'origin' => $isInbound ? 'PT Sumber Kabel' : null,
            'destination' => $isInbound ? null : 'Area Assembly B',
            'sender_name' => $isInbound ? 'Agus Kurir' : null,
            'recipient_name' => $isInbound ? $recorder->name : null,
            'taker_name' => $isInbound ? null : 'Deni Teknisi',
            'giver_name' => $isInbound ? null : $recorder->name,
            'recorded_by' => $recorder->id,
            'created_by' => $recorder->id,
            'updated_by' => null,
        ];

        return Transaction::create(array_merge($defaults, $overrides));
    }

    public function test_unauthenticated_and_inactive_users_cannot_access_history(): void
    {
        $this->getJson('/api/operational/transactions')->assertStatus(401);

        $inactive = User::factory()->petugas()->create(['is_active' => false]);
        Sanctum::actingAs($inactive);

        $this->getJson('/api/operational/transactions')->assertStatus(403);
    }

    public function test_admin_and_petugas_can_list_combined_history_paginated_20_per_page_newest_first(): void
    {
        $petugas = User::factory()->petugas()->create(['name' => 'Budi Store']);
        $admin = User::factory()->admin()->create(['name' => 'Sari Admin']);
        $workType = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);

        $baseTime = Carbon::parse('2026-11-10 08:00:00', 'Asia/Jakarta');

        for ($i = 1; $i <= 25; $i++) {
            $this->seedTransaction([
                'recorder' => $i % 2 === 0 ? $petugas : $admin,
                'work_type' => $workType,
                'type' => $i % 2 === 0 ? Transaction::TYPE_KELUAR : Transaction::TYPE_MASUK,
                'item_name' => sprintf('Barang Uji #%02d', $i),
                'transaction_datetime' => $baseTime->copy()->addMinutes($i * 15),
            ]);
        }

        Sanctum::actingAs($petugas);

        $page1 = $this->getJson('/api/operational/transactions');
        $page1->assertStatus(200)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.total', 25)
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('data.0.item_name', 'Barang Uji #25')
            ->assertJsonPath('data.19.item_name', 'Barang Uji #06')
            ->assertJsonPath('summary.total', 25)
            ->assertJsonPath('summary.masuk', 13)
            ->assertJsonPath('summary.keluar', 12);

        $page2 = $this->getJson('/api/operational/transactions?page=2');
        $page2->assertStatus(200)
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('data.0.item_name', 'Barang Uji #05')
            ->assertJsonPath('data.4.item_name', 'Barang Uji #01');

        Sanctum::actingAs($admin);
        $this->getJson('/api/operational/transactions')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 25);
    }

    public function test_combined_filters_and_free_text_search_execute_with_and_logic_on_backend(): void
    {
        $budi = User::factory()->petugas()->create(['name' => 'Budi Santoso', 'username' => 'budi.santoso']);
        $andi = User::factory()->petugas()->create(['name' => 'Andi Wijaya', 'username' => 'andi.wijaya']);

        $wtProduksi = WorkType::create(['name' => 'Produksi', 'is_active' => true]);
        $wtMaintenance = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);

        // Target transaksi yang harus lolos ketika semua filter digabungkan
        $target = $this->seedTransaction([
            'recorder' => $budi,
            'work_type' => $wtMaintenance,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-12 10:30:00',
            'item_name' => 'Motor Servo Panasonic',
            'origin' => 'Vendor Otomasi Surabaya',
            'sender_name' => 'Rudi Ekspedisi',
            'work_description' => 'Penggantian unit motor line packaging',
        ]);

        // Distractor 1: jenis transaksi berbeda (KELUAR)
        $this->seedTransaction([
            'recorder' => $budi,
            'work_type' => $wtMaintenance,
            'type' => Transaction::TYPE_KELUAR,
            'transaction_datetime' => '2026-11-12 11:00:00',
            'item_name' => 'Motor Servo Panasonic',
            'destination' => 'Line Packaging',
            'work_description' => 'Penggantian unit motor line packaging',
        ]);

        // Distractor 2: petugas berbeda (Andi)
        $this->seedTransaction([
            'recorder' => $andi,
            'work_type' => $wtMaintenance,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-12 12:00:00',
            'item_name' => 'Motor Servo Panasonic',
            'origin' => 'Vendor Otomasi Surabaya',
            'work_description' => 'Penggantian unit motor line packaging',
        ]);

        // Distractor 3: jenis pekerjaan berbeda (Produksi)
        $this->seedTransaction([
            'recorder' => $budi,
            'work_type' => $wtProduksi,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-12 13:00:00',
            'item_name' => 'Motor Servo Panasonic',
            'origin' => 'Vendor Otomasi Surabaya',
            'work_description' => 'Penggantian unit motor line packaging',
        ]);

        // Distractor 4: di luar rentang tanggal
        $this->seedTransaction([
            'recorder' => $budi,
            'work_type' => $wtMaintenance,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-05 09:00:00',
            'item_name' => 'Motor Servo Panasonic',
            'origin' => 'Vendor Otomasi Surabaya',
            'work_description' => 'Penggantian unit motor line packaging',
        ]);

        Sanctum::actingAs($budi);

        // Uji seluruh filter sekaligus (AND logic + case-insensitive)
        $query = http_build_query([
            'search' => 'packaging',
            'item_name' => 'motor servo',
            'recorded_by' => $budi->id,
            'type' => 'MASUK',
            'work_type_id' => $wtMaintenance->id,
            'date_from' => '2026-11-10',
            'date_to' => '2026-11-15',
        ]);

        $response = $this->getJson('/api/operational/transactions?' . $query);
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $target->id)
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.masuk', 1)
            ->assertJsonPath('summary.keluar', 0);

        // Uji pencarian tanpa hasil -> empty state data
        $emptyResponse = $this->getJson('/api/operational/transactions?search=BarangYangSamaSekaliTidakAda');
        $emptyResponse->assertStatus(200)
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0)
            ->assertJsonPath('summary.total', 0);
    }

    public function test_operational_user_can_view_transaction_detail_with_photos(): void
    {
        $petugas = User::factory()->petugas()->create(['name' => 'Petugas Foto']);
        $tx = $this->seedTransaction([
            'recorder' => $petugas,
            'item_name' => 'Sensor Proximity Omron',
        ]);

        TransactionPhoto::create([
            'transaction_id' => $tx->id,
            'file_path' => 'transactions/sample/foto1.jpg',
            'original_name' => 'foto1.jpg',
            'mime_type' => 'image/jpeg',
            'file_size' => 102400,
        ]);

        Sanctum::actingAs($petugas);

        $this->getJson('/api/operational/transactions/' . $tx->id)
            ->assertStatus(200)
            ->assertJsonPath('transaction.id', $tx->id)
            ->assertJsonPath('transaction.item_name', 'Sensor Proximity Omron')
            ->assertJsonCount(1, 'transaction.photos')
            ->assertJsonPath('transaction.photos.0.original_name', 'foto1.jpg');
    }

    public function test_admin_can_update_and_soft_delete_transaction_with_audit_logs_and_petugas_is_forbidden(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Admin Pengelola']);
        $petugas = User::factory()->petugas()->create(['name' => 'Petugas Gudang']);
        $wtOld = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);
        $wtNew = WorkType::create(['name' => 'Proyek Baru', 'is_active' => true]);

        $tx = $this->seedTransaction([
            'recorder' => $petugas,
            'work_type' => $wtOld,
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => '2026-11-12 09:00:00',
            'item_name' => 'Pipa PVC 2 Inch',
            'quantity' => 5,
            'unit' => 'Batang',
            'origin' => 'Toko Bangunan Jaya',
            'sender_name' => 'Pak Joko',
        ]);

        // Petugas tidak boleh mengedit atau menghapus transaksi (403 Forbidden)
        Sanctum::actingAs($petugas);

        $this->putJson('/api/admin/transactions/' . $tx->id, [
            'transaction_datetime' => '2026-11-12 09:30:00',
            'item_name' => 'Diubah Petugas',
            'quantity' => 10,
            'unit' => 'Batang',
            'work_type_id' => $wtNew->id,
            'origin' => 'Toko Baru',
            'sender_name' => 'Pak Joko',
        ])->assertStatus(403);

        $this->deleteJson('/api/admin/transactions/' . $tx->id)->assertStatus(403);

        // Admin dapat mengubah transaksi dan tercatat di audit_logs
        Sanctum::actingAs($admin);

        $updateResponse = $this->putJson('/api/admin/transactions/' . $tx->id, [
            'transaction_datetime' => '2026-11-12 10:15:00',
            'item_name' => 'Pipa PVC 2 Inch (Revisi)',
            'quantity' => 8.5,
            'unit' => 'Batang',
            'work_type_id' => $wtNew->id,
            'work_description' => 'Koreksi jumlah barang setelah cek ulang.',
            'origin' => 'Distributor Pipa Utama',
            'sender_name' => 'Pak Joko Revisi',
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('message', 'Data transaksi berhasil diperbarui.')
            ->assertJsonPath('transaction.item_name', 'Pipa PVC 2 Inch (Revisi)')
            ->assertJsonPath('transaction.work_type_id', $wtNew->id)
            ->assertJsonPath('transaction.updated_by', $admin->id);

        $updateLog = AuditLog::where('transaction_id', $tx->id)
            ->where('action', AuditLog::ACTION_UPDATE)
            ->first();
        $this->assertNotNull($updateLog);
        $this->assertSame('Pipa PVC 2 Inch', $updateLog->old_values['item_name']);
        $this->assertSame('Pipa PVC 2 Inch (Revisi)', $updateLog->new_values['item_name']);

        // Admin tidak boleh mengatur waktu transaksi ke masa depan
        $this->putJson('/api/admin/transactions/' . $tx->id, [
            'transaction_datetime' => now()->addHour()->format('Y-m-d\TH:i'),
            'item_name' => 'Invalid Masa Depan',
            'quantity' => 1,
            'unit' => 'Unit',
            'work_type_id' => $wtNew->id,
            'origin' => 'Vendor',
            'sender_name' => 'Kurir',
        ])->assertStatus(422)->assertJsonValidationErrors(['transaction_datetime']);

        // Admin dapat melakukan soft delete transaksi & tidak lagi tampil di riwayat
        $this->deleteJson('/api/admin/transactions/' . $tx->id)
            ->assertStatus(200)
            ->assertJsonPath('message', 'Transaksi berhasil dihapus.');

        $this->assertSoftDeleted('transactions', ['id' => $tx->id]);

        $deleteLog = AuditLog::where('transaction_id', $tx->id)
            ->where('action', AuditLog::ACTION_DELETE)
            ->first();
        $this->assertNotNull($deleteLog);
        $this->assertNull($deleteLog->new_values);

        $this->getJson('/api/operational/transactions')
            ->assertStatus(200)
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
    }
}
