<?php

namespace Tests\Feature\Transaction;

use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionCreationTest extends TestCase
{
    use RefreshDatabase;

    private function fakeValidPhoto(string $name = 'foto.jpg'): UploadedFile
    {
        $jpgBytes = base64_decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=');

        return UploadedFile::fake()->createWithContent($name, $jpgBytes);
    }

    public function test_unauthenticated_and_inactive_users_cannot_create_transactions(): void
    {
        Storage::fake('public');

        $this->getJson('/api/operational/work-types')->assertStatus(401);
        $this->postJson('/api/operational/transactions/in', [])->assertStatus(401);
        $this->postJson('/api/operational/transactions/out', [])->assertStatus(401);

        $inactive = User::factory()->petugas()->create(['is_active' => false]);
        Sanctum::actingAs($inactive);

        $this->getJson('/api/operational/work-types')->assertStatus(403);
        $this->postJson('/api/operational/transactions/in', [])->assertStatus(403);
        $this->postJson('/api/operational/transactions/out', [])->assertStatus(403);
    }

    public function test_operational_work_types_returns_only_active_items(): void
    {
        $petugas = User::factory()->petugas()->create();
        WorkType::create(['name' => 'Aktif Satu', 'description' => null, 'is_active' => true]);
        WorkType::create(['name' => 'Nonaktif Satu', 'description' => null, 'is_active' => false]);

        Sanctum::actingAs($petugas);

        $response = $this->getJson('/api/operational/work-types');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Aktif Satu');
    }

    public function test_petugas_can_create_inbound_transaction_and_cannot_spoof_recipient(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create([
            'name' => 'Budi Store Asli',
            'username' => 'budi.asli',
        ]);
        $otherUser = User::factory()->admin()->create(['name' => 'Nama Palsu']);
        $workType = WorkType::create(['name' => 'Produksi', 'is_active' => true]);

        Sanctum::actingAs($petugas);

        $datetime = now()->subMinutes(10)->format('Y-m-d\TH:i');

        $response = $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => $datetime,
            'item_name' => 'Baut Baja M12',
            'quantity' => 12.5,
            'unit' => 'Kg',
            'work_type_id' => $workType->id,
            'work_description' => 'Pengadaan rutin lini perakitan.',
            'origin' => 'PT Supplier Baja',
            'sender_name' => 'Hendra Kurir',
            // Upaya spoofing oleh client harus diabaikan backend
            'recipient_name' => 'Nama Palsu',
            'recorded_by' => $otherUser->id,
            'created_by' => $otherUser->id,
            'photos' => [
                $this->fakeValidPhoto('datang_1.jpg'),
                $this->fakeValidPhoto('datang_2.jpg'),
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('message', 'Transaksi barang masuk berhasil disimpan.')
            ->assertJsonPath('transaction.type', Transaction::TYPE_MASUK)
            ->assertJsonPath('transaction.recipient_name', 'Budi Store Asli')
            ->assertJsonPath('transaction.recorded_by', $petugas->id)
            ->assertJsonPath('transaction.created_by', $petugas->id)
            ->assertJsonCount(2, 'transaction.photos');

        $transaction = Transaction::first();
        $this->assertNotNull($transaction);
        $this->assertSame(Transaction::TYPE_MASUK, $transaction->type);
        $this->assertSame('Budi Store Asli', $transaction->recipient_name);
        $this->assertSame($petugas->id, $transaction->recorded_by);
        $this->assertSame($petugas->id, $transaction->created_by);
        $this->assertNull($transaction->destination);
        $this->assertNull($transaction->taker_name);
        $this->assertNull($transaction->giver_name);

        $photos = TransactionPhoto::where('transaction_id', $transaction->id)->get();
        $this->assertCount(2, $photos);
        Storage::disk('public')->assertExists($photos[0]->file_path);
        Storage::disk('public')->assertExists($photos[1]->file_path);
    }

    public function test_petugas_can_create_outbound_transaction_and_cannot_spoof_giver(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create([
            'name' => 'Siti Security Asli',
            'username' => 'siti.asli',
        ]);
        $otherUser = User::factory()->admin()->create(['name' => 'Pemberi Palsu']);
        $workType = WorkType::create(['name' => 'Maintenance', 'is_active' => true]);

        Sanctum::actingAs($petugas);

        $datetime = now()->subMinutes(5)->format('Y-m-d\TH:i');

        $response = $this->postJson('/api/operational/transactions/out', [
            'transaction_datetime' => $datetime,
            'item_name' => 'Kabel Power 4x16mm',
            'quantity' => 25,
            'unit' => 'Meter',
            'work_type_id' => $workType->id,
            'work_description' => 'Perbaikan panel gedung B.',
            'destination' => 'Area Produksi Line 2',
            'taker_name' => 'Wahyu Teknisi',
            // Upaya spoofing oleh client harus diabaikan backend
            'giver_name' => 'Pemberi Palsu',
            'recorded_by' => $otherUser->id,
            'created_by' => $otherUser->id,
            'photos' => [
                $this->fakeValidPhoto('keluar_1.jpg'),
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('message', 'Transaksi barang keluar berhasil disimpan.')
            ->assertJsonPath('transaction.type', Transaction::TYPE_KELUAR)
            ->assertJsonPath('transaction.giver_name', 'Siti Security Asli')
            ->assertJsonPath('transaction.recorded_by', $petugas->id)
            ->assertJsonPath('transaction.created_by', $petugas->id)
            ->assertJsonCount(1, 'transaction.photos');

        $transaction = Transaction::first();
        $this->assertNotNull($transaction);
        $this->assertSame(Transaction::TYPE_KELUAR, $transaction->type);
        $this->assertSame('Siti Security Asli', $transaction->giver_name);
        $this->assertSame($petugas->id, $transaction->recorded_by);
        $this->assertNull($transaction->origin);
        $this->assertNull($transaction->sender_name);
        $this->assertNull($transaction->recipient_name);
    }

    public function test_transaction_validation_enforces_required_quantity_future_time_description_and_active_work_type(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create();
        $inactiveWorkType = WorkType::create(['name' => 'Arsip Lama', 'is_active' => false]);

        Sanctum::actingAs($petugas);

        // Field wajib kosong & foto tidak ada
        $this->postJson('/api/operational/transactions/in', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'transaction_datetime',
                'item_name',
                'quantity',
                'unit',
                'work_type_id',
                'origin',
                'sender_name',
                'photos',
            ]);

        // Jumlah <= 0, lebih dari 2 desimal, waktu masa depan, deskripsi > 500 karakter, dan jenis pekerjaan nonaktif
        $this->postJson('/api/operational/transactions/out', [
            'transaction_datetime' => now()->addHours(2)->format('Y-m-d\TH:i'),
            'item_name' => 'Barang Uji',
            'quantity' => 0,
            'unit' => 'Unit',
            'work_type_id' => $inactiveWorkType->id,
            'work_description' => str_repeat('a', 501),
            'destination' => 'Gudang C',
            'taker_name' => 'Andi',
            'photos' => [$this->fakeValidPhoto()],
        ])->assertStatus(422)
            ->assertJsonValidationErrors([
                'transaction_datetime',
                'quantity',
                'work_type_id',
                'work_description',
            ]);

        $activeWorkType = WorkType::create(['name' => 'Operasional', 'is_active' => true]);

        // Maksimal 2 angka desimal
        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->format('Y-m-d\TH:i'),
            'item_name' => 'Resin Kimia',
            'quantity' => '1.234',
            'unit' => 'Kg',
            'work_type_id' => $activeWorkType->id,
            'origin' => 'Vendor Kimia',
            'sender_name' => 'Roni',
            'photos' => [$this->fakeValidPhoto()],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        // Petugas dibatasi maksimal 24 jam ke belakang
        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subHours(30)->format('Y-m-d\TH:i'),
            'item_name' => 'Barang Lampau',
            'quantity' => 5,
            'unit' => 'Box',
            'work_type_id' => $activeWorkType->id,
            'origin' => 'Vendor A',
            'sender_name' => 'Joko',
            'photos' => [$this->fakeValidPhoto()],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_datetime']);

        // Admin diperbolehkan mencatat waktu > 24 jam yang lalu (tetap tidak boleh masa depan)
        $admin = User::factory()->admin()->create(['name' => 'Admin Koreksi']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/operational/transactions/in', [
            'transaction_datetime' => now()->subHours(30)->format('Y-m-d\TH:i'),
            'item_name' => 'Barang Lampau Admin',
            'quantity' => 5,
            'unit' => 'Box',
            'work_type_id' => $activeWorkType->id,
            'origin' => 'Vendor A',
            'sender_name' => 'Joko',
            'photos' => [$this->fakeValidPhoto()],
        ])->assertStatus(201)
            ->assertJsonPath('transaction.recipient_name', 'Admin Koreksi');
    }
}
