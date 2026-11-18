<?php

namespace Tests\Feature\Admin;

use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private function statefulHeaders(): array
    {
        return [
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/',
            'Accept' => 'application/json',
        ];
    }

    public function test_unauthenticated_and_petugas_cannot_access_user_management_endpoints(): void
    {
        $petugas = User::factory()->petugas()->create();

        $this->getJson('/api/admin/users')->assertStatus(401);

        Sanctum::actingAs($petugas);

        $this->getJson('/api/admin/users')->assertStatus(403);
        $this->postJson('/api/admin/users', [
            'name' => 'Test Petugas',
            'username' => 'test.petugas',
            'password' => 'Password123',
            'role' => User::ROLE_PETUGAS,
        ])->assertStatus(403);

        $target = User::factory()->petugas()->create();
        $this->getJson("/api/admin/users/{$target->id}")->assertStatus(403);
        $this->putJson("/api/admin/users/{$target->id}", [
            'name' => 'Changed',
            'username' => $target->username,
            'role' => User::ROLE_PETUGAS,
            'is_active' => true,
        ])->assertStatus(403);
        $this->patchJson("/api/admin/users/{$target->id}/status", ['is_active' => false])->assertStatus(403);
        $this->deleteJson("/api/admin/users/{$target->id}")->assertStatus(403);
    }

    public function test_admin_can_list_search_and_filter_users(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Admin Utama', 'username' => 'admin.utama']);
        User::factory()->petugas()->create(['name' => 'Budi Security', 'username' => 'budi.sec', 'is_active' => true]);
        User::factory()->petugas()->create(['name' => 'Sari Nonaktif', 'username' => 'sari.off', 'is_active' => false]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/users?search=Budi&role=petugas&status=active');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.username', 'budi.sec')
            ->assertJsonPath('summary.total', 3)
            ->assertJsonPath('summary.active', 2)
            ->assertJsonPath('summary.inactive', 1)
            ->assertJsonPath('summary.active_admins', 1);
    }

    public function test_admin_can_create_user_and_validation_enforces_unique_username_and_min_password(): void
    {
        $admin = User::factory()->admin()->create(['username' => 'admin.utama']);
        Sanctum::actingAs($admin);

        // Password kurang dari 8 karakter & username duplikat ditolak
        $this->postJson('/api/admin/users', [
            'name' => 'Pengguna Baru',
            'username' => 'admin.utama',
            'email' => 'baru@inouttrack.local',
            'password' => 'short',
            'role' => User::ROLE_PETUGAS,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['username', 'password']);

        // Pembuatan akun valid berhasil
        $response = $this->postJson('/api/admin/users', [
            'name' => 'Rudi Store',
            'username' => 'Rudi.Store',
            'email' => 'rudi@inouttrack.local',
            'password' => 'Rahasia123!',
            'role' => User::ROLE_PETUGAS,
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('message', 'Akun pengguna berhasil ditambahkan.')
            ->assertJsonPath('user.username', 'rudi.store')
            ->assertJsonPath('user.role', User::ROLE_PETUGAS)
            ->assertJsonPath('user.is_active', true);

        $createdUser = User::where('username', 'rudi.store')->first();
        $this->assertNotNull($createdUser);
        $this->assertTrue(Hash::check('Rahasia123!', $createdUser->password));
    }

    public function test_admin_can_update_user_without_requiring_password(): void
    {
        $admin = User::factory()->admin()->create();
        $petugas = User::factory()->petugas()->create([
            'name' => 'Petugas Lama',
            'username' => 'petugas.lama',
            'password' => Hash::make('PasswordAwal123'),
        ]);

        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/admin/users/{$petugas->id}", [
            'name' => 'Petugas Baru',
            'username' => 'petugas.lama',
            'email' => 'petugas.baru@inouttrack.local',
            'password' => '',
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.name', 'Petugas Baru')
            ->assertJsonPath('user.role', User::ROLE_ADMIN);

        $petugas->refresh();
        $this->assertTrue(Hash::check('PasswordAwal123', $petugas->password));
    }

    public function test_deactivated_user_cannot_login(): void
    {
        $admin = User::factory()->admin()->create();
        $petugas = User::factory()->petugas()->create([
            'username' => 'petugas.aktif',
            'password' => Hash::make('Petugas12345!'),
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$petugas->id}/status", [
            'is_active' => false,
        ])->assertStatus(200)
            ->assertJsonPath('user.is_active', false);

        // Pastikan akun nonaktif gagal login
        $loginResponse = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'login' => 'petugas.aktif',
                'password' => 'Petugas12345!',
            ]);

        $loginResponse->assertStatus(403)
            ->assertJsonPath('message', 'Akun Anda telah dinonaktifkan. Silakan hubungi Staf Administrasi (Admin).');
    }

    public function test_admin_cannot_deactivate_demote_or_delete_self_or_last_active_admin(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$admin->id}/status", ['is_active' => false])
            ->assertStatus(422);

        $this->putJson("/api/admin/users/{$admin->id}", [
            'name' => $admin->name,
            'username' => $admin->username,
            'role' => User::ROLE_PETUGAS,
            'is_active' => true,
        ])->assertStatus(422);

        $this->deleteJson("/api/admin/users/{$admin->id}")
            ->assertStatus(422);

        // Admin kedua mencoba menonaktifkan satu-satunya admin lain? Tidak, jika ada 2 admin aktif,
        // menonaktifkan admin lain diperbolehkan; tetapi jika hanya 1 admin aktif tersisa, tidak boleh.
        $secondAdmin = User::factory()->admin()->create();
        $this->patchJson("/api/admin/users/{$secondAdmin->id}/status", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('user.is_active', false);
    }

    public function test_user_with_linked_transactions_or_audit_logs_cannot_be_deleted_but_unlinked_user_can(): void
    {
        $admin = User::factory()->admin()->create();
        $linkedPetugas = User::factory()->petugas()->create();
        $linkedAuditAdmin = User::factory()->admin()->create();
        $unlinkedPetugas = User::factory()->petugas()->create();

        $workType = WorkType::create([
            'name' => 'Maintenance Genset',
            'description' => 'Perawatan rutin',
            'is_active' => true,
        ]);

        $transaction = Transaction::create([
            'type' => Transaction::TYPE_MASUK,
            'transaction_datetime' => now(),
            'item_name' => 'Oli Mesin',
            'quantity' => 5,
            'unit' => 'Liter',
            'work_type_id' => $workType->id,
            'work_description' => 'Pengisian stok',
            'origin' => 'Vendor A',
            'sender_name' => 'Supriyadi',
            'recipient_name' => $linkedPetugas->name,
            'recorded_by' => $linkedPetugas->id,
            'created_by' => $linkedPetugas->id,
            'updated_by' => $linkedPetugas->id,
        ]);

        // Bahkan jika transaksi di-soft-delete, user tetap tidak boleh dihapus permanen
        $transaction->delete();

        AuditLog::create([
            'user_id' => $linkedAuditAdmin->id,
            'transaction_id' => $transaction->id,
            'action' => AuditLog::ACTION_DELETE,
            'old_values' => ['item_name' => 'Oli Mesin'],
            'new_values' => null,
            'description' => 'Soft delete test',
            'ip_address' => '127.0.0.1',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/admin/users/{$linkedPetugas->id}")
            ->assertStatus(422);

        $this->deleteJson("/api/admin/users/{$linkedAuditAdmin->id}")
            ->assertStatus(422);

        $this->deleteJson("/api/admin/users/{$unlinkedPetugas->id}")
            ->assertStatus(200)
            ->assertJsonPath('message', 'Akun pengguna berhasil dihapus secara permanen.');

        $this->assertDatabaseMissing('users', ['id' => $unlinkedPetugas->id]);
    }
}
