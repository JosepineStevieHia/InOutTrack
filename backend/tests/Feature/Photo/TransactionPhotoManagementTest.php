<?php

namespace Tests\Feature\Photo;

use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionPhotoManagementTest extends TestCase
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

    private function createSampleTransaction(User $user): Transaction
    {
        $workType = WorkType::create([
            'name' => 'Produksi',
            'description' => 'Kebutuhan lini produksi',
            'is_active' => true,
        ]);

        return Transaction::create([
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => now(),
            'item_name' => 'Kabel NYM 3x2.5',
            'quantity' => 10,
            'unit' => 'Roll',
            'work_type_id' => $workType->id,
            'work_description' => 'Stok gudang',
            'origin' => 'PT Kabel Jaya',
            'sender_name' => 'Agus',
            'recipient_name' => $user->name,
            'recorded_by' => $user->id,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
    }

    public function test_guest_and_inactive_user_cannot_access_photo_endpoints(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create();
        $transaction = $this->createSampleTransaction($petugas);

        $this->postJson('/api/operational/transaction-photos/validate', [])
            ->assertStatus(401);

        $inactive = User::factory()->petugas()->create(['is_active' => false]);
        Sanctum::actingAs($inactive);

        $this->getJson("/api/operational/transactions/{$transaction->id}/photos")
            ->assertStatus(403);
    }

    public function test_petugas_can_validate_upload_before_transaction_save(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create();
        Sanctum::actingAs($petugas);

        $response = $this->postJson('/api/operational/transaction-photos/validate', [
            'photos' => [
                $this->fakeValidPhoto('kamera_1.jpg', 'jpg'),
                $this->fakeValidPhoto('galeri_2.png', 'png'),
                $this->fakeValidPhoto('galeri_3.webp', 'webp'),
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('count', 3)
            ->assertJsonCount(3, 'photos');

        // File uji sementara harus dibersihkan kembali setelah validasi selesai
        $this->assertEmpty(Storage::disk('public')->allFiles('transaction-photos/verify-temp'));
    }

    public function test_petugas_and_admin_can_store_photos_with_collision_free_names(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create();
        $transaction = $this->createSampleTransaction($petugas);

        Sanctum::actingAs($petugas);

        // Unggah 2 file dengan nama asli yang identik sekaligus
        $response = $this->postJson("/api/operational/transactions/{$transaction->id}/photos", [
            'photos' => [
                $this->fakeValidPhoto('bukti_barang.jpg', 'jpg'),
                $this->fakeValidPhoto('bukti_barang.jpg', 'jpg'),
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonCount(2, 'photos');

        $photos = TransactionPhoto::query()->where('transaction_id', $transaction->id)->get();
        $this->assertCount(2, $photos);
        $this->assertNotSame($photos[0]->file_path, $photos[1]->file_path);

        Storage::disk('public')->assertExists($photos[0]->file_path);
        Storage::disk('public')->assertExists($photos[1]->file_path);

        // Admin menambahkan 1 foto WEBP lagi (total = 3, batas maksimal)
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->postJson("/api/operational/transactions/{$transaction->id}/photos", [
            'photos' => [
                $this->fakeValidPhoto('tambahan.webp', 'webp'),
            ],
        ])->assertStatus(201)
            ->assertJsonCount(1, 'photos');

        $this->assertCount(3, TransactionPhoto::where('transaction_id', $transaction->id)->get());

        // Menambah foto ke-4 ditolak dengan 422
        $this->postJson("/api/operational/transactions/{$transaction->id}/photos", [
            'photos' => [
                $this->fakeValidPhoto('keempat.png', 'png'),
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos']);
    }

    public function test_photo_validation_rejects_invalid_format_size_and_count(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create();
        Sanctum::actingAs($petugas);

        // Lebih dari 3 foto sekaligus ditolak
        $this->postJson('/api/operational/transaction-photos/validate', [
            'photos' => [
                $this->fakeValidPhoto('1.jpg', 'jpg'),
                $this->fakeValidPhoto('2.jpg', 'jpg'),
                $this->fakeValidPhoto('3.jpg', 'jpg'),
                $this->fakeValidPhoto('4.jpg', 'jpg'),
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos']);

        // Format tidak diizinkan (pdf / text menyamar .jpg) ditolak
        $pdfFile = UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf');
        $fakeJpg = UploadedFile::fake()->createWithContent('palsu.jpg', 'bukan file gambar asli');

        $this->postJson('/api/operational/transaction-photos/validate', [
            'photos' => [$pdfFile],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos.0']);

        $this->postJson('/api/operational/transaction-photos/validate', [
            'photos' => [$fakeJpg],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos.0']);

        // Ukuran > 5 MB (5200 KB) ditolak
        $oversizedContent = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
            . str_repeat('0', 5200 * 1024);
        $oversizedFile = UploadedFile::fake()->createWithContent('terlalu_besar.png', $oversizedContent);

        $this->postJson('/api/operational/transaction-photos/validate', [
            'photos' => [$oversizedFile],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['photos.0']);
    }

    public function test_photo_can_be_replaced_and_deleted_except_last_photo(): void
    {
        Storage::fake('public');

        $petugas = User::factory()->petugas()->create();
        $transaction = $this->createSampleTransaction($petugas);

        Sanctum::actingAs($petugas);

        $this->postJson("/api/operational/transactions/{$transaction->id}/photos", [
            'photos' => [
                $this->fakeValidPhoto('awal_1.jpg', 'jpg'),
                $this->fakeValidPhoto('awal_2.png', 'png'),
            ],
        ])->assertStatus(201);

        $photos = TransactionPhoto::where('transaction_id', $transaction->id)->orderBy('id')->get();
        $firstPhoto = $photos[0];
        $secondPhoto = $photos[1];
        $oldPath = $firstPhoto->file_path;

        // Ganti foto pertama
        $replaceResponse = $this->postJson("/api/operational/transaction-photos/{$firstPhoto->id}/replace", [
            'photo' => $this->fakeValidPhoto('pengganti.webp', 'webp'),
        ]);

        $replaceResponse->assertStatus(200)
            ->assertJsonPath('message', 'Foto transaksi berhasil diganti.')
            ->assertJsonPath('photo.mime_type', 'image/webp');

        $firstPhoto->refresh();
        $this->assertNotSame($oldPath, $firstPhoto->file_path);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($firstPhoto->file_path);

        // Hapus foto kedua masih diizinkan karena tersisa 1 foto
        $this->deleteJson("/api/operational/transaction-photos/{$secondPhoto->id}")
            ->assertStatus(200);

        Storage::disk('public')->assertMissing($secondPhoto->file_path);
        $this->assertDatabaseMissing('transaction_photos', ['id' => $secondPhoto->id]);

        // Menghapus foto terakhir ditolak (422) agar transaksi tetap memiliki minimal 1 foto
        $this->deleteJson("/api/operational/transaction-photos/{$firstPhoto->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['photo']);
    }
}
