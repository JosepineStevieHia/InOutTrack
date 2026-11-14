<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AuthenticationAndAuthorizationTest extends TestCase
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

    public function test_admin_can_login_with_username_and_receives_full_permissions(): void
    {
        $admin = User::factory()->admin()->create([
            'name' => 'Staf Administrasi',
            'username' => 'admin.utama',
            'email' => 'admin@inouttrack.local',
            'password' => Hash::make('Admin12345!'),
            'is_active' => true,
        ]);

        $response = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'login' => 'admin.utama',
                'password' => 'Admin12345!',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Login berhasil.')
            ->assertJsonPath('user.id', $admin->id)
            ->assertJsonPath('user.username', 'admin.utama')
            ->assertJsonPath('user.role', User::ROLE_ADMIN)
            ->assertJsonPath('user.is_active', true)
            ->assertJsonPath('user.permissions.can_manage_users', true)
            ->assertJsonPath('user.permissions.can_manage_work_types', true)
            ->assertJsonPath('user.permissions.can_manage_transactions', true)
            ->assertJsonPath('user.permissions.can_export_transactions', true)
            ->assertJsonPath('user.permissions.can_view_audit_logs', true);

        $this->assertAuthenticatedAs($admin, 'web');
    }

    public function test_petugas_can_login_with_email_and_receives_operational_permissions_only(): void
    {
        $petugas = User::factory()->petugas()->create([
            'name' => 'Petugas Store',
            'username' => 'petugas.store',
            'email' => 'store@inouttrack.local',
            'password' => Hash::make('Petugas12345!'),
            'is_active' => true,
        ]);

        $response = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'email' => 'store@inouttrack.local',
                'password' => 'Petugas12345!',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.id', $petugas->id)
            ->assertJsonPath('user.role', User::ROLE_PETUGAS)
            ->assertJsonPath('user.permissions.can_create_transactions', true)
            ->assertJsonPath('user.permissions.can_view_transactions', true)
            ->assertJsonPath('user.permissions.can_manage_users', false)
            ->assertJsonPath('user.permissions.can_manage_work_types', false)
            ->assertJsonPath('user.permissions.can_manage_transactions', false)
            ->assertJsonPath('user.permissions.can_export_transactions', false)
            ->assertJsonPath('user.permissions.can_view_audit_logs', false);

        $this->assertAuthenticatedAs($petugas, 'web');
    }

    public function test_login_fails_with_invalid_password_or_unknown_user(): void
    {
        User::factory()->petugas()->create([
            'username' => 'petugas.security',
            'password' => Hash::make('Benar12345!'),
        ]);

        // Password salah
        $wrongPass = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'login' => 'petugas.security',
                'password' => 'SalahPassword!',
            ]);

        $wrongPass->assertStatus(401)
            ->assertJsonPath('message', 'Username/email atau password yang Anda masukkan salah.');

        $this->assertGuest('web');

        // Username tidak ditemukan
        $unknownUser = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'login' => 'akun.tidak.ada',
                'password' => 'Benar12345!',
            ]);

        $unknownUser->assertStatus(401);
        $this->assertGuest('web');
    }

    public function test_login_validation_fails_when_fields_are_empty(): void
    {
        $response = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['login', 'password']);
    }

    public function test_inactive_user_cannot_login(): void
    {
        User::factory()->petugas()->create([
            'username' => 'petugas.nonaktif',
            'email' => 'nonaktif@inouttrack.local',
            'password' => Hash::make('Petugas12345!'),
            'is_active' => false,
        ]);

        $response = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'login' => 'petugas.nonaktif',
                'password' => 'Petugas12345!',
            ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Akun Anda telah dinonaktifkan. Silakan hubungi Staf Administrasi (Admin).');

        $this->assertGuest('web');
    }

    public function test_login_rate_limiting_blocks_after_five_failed_attempts(): void
    {
        RateLimiter::clear('login:petugas.uji|127.0.0.1');

        User::factory()->petugas()->create([
            'username' => 'petugas.uji',
            'password' => Hash::make('PasswordBenar123!'),
        ]);

        // 5x percobaan gagal harus mengembalikan 401
        for ($i = 1; $i <= 5; $i++) {
            $res = $this->withHeaders($this->statefulHeaders())
                ->postJson('/api/auth/login', [
                    'login' => 'petugas.uji',
                    'password' => 'PasswordSalah!',
                ]);
            $res->assertStatus(401);
        }

        // Percobaan ke-6 harus ditolak dengan 429 Too Many Requests
        $blocked = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'login' => 'petugas.uji',
                'password' => 'PasswordBenar123!',
            ]);

        $blocked->assertStatus(429)
            ->assertJsonStructure(['message', 'retry_after']);
    }

    public function test_authenticated_user_can_fetch_me_profile_and_guest_gets_401(): void
    {
        // Guest belum login -> 401
        $guestRes = $this->getJson('/api/auth/me');
        $guestRes->assertStatus(401)
            ->assertJsonPath('message', 'Unauthenticated. Silakan login terlebih dahulu.');

        // User login -> 200
        $user = User::factory()->petugas()->create([
            'username' => 'petugas.aktif',
            'is_active' => true,
        ]);

        $authRes = $this->actingAs($user, 'sanctum')->getJson('/api/auth/me');
        $authRes->assertStatus(200)
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.username', 'petugas.aktif')
            ->assertJsonPath('user.role', User::ROLE_PETUGAS);
    }

    public function test_user_deactivated_mid_session_is_immediately_blocked_with_403(): void
    {
        $user = User::factory()->petugas()->create([
            'username' => 'petugas.mid',
            'is_active' => false,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me');

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Akun Anda telah dinonaktifkan. Silakan hubungi Staf Administrasi (Admin).');
    }

    public function test_user_can_logout_and_session_is_invalidated(): void
    {
        $user = User::factory()->petugas()->create([
            'username' => 'petugas.logout',
            'password' => Hash::make('Petugas12345!'),
            'is_active' => true,
        ]);

        // Login stateful
        $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/login', [
                'login' => 'petugas.logout',
                'password' => 'Petugas12345!',
            ])->assertStatus(200);

        $this->assertAuthenticatedAs($user, 'web');

        // Logout
        $logoutRes = $this->withHeaders($this->statefulHeaders())
            ->postJson('/api/auth/logout');

        $logoutRes->assertStatus(200)
            ->assertJsonPath('message', 'Logout berhasil.');

        $this->assertGuest('web');
    }

    public function test_role_middleware_allows_admin_and_blocks_petugas_with_403_on_admin_endpoints(): void
    {
        $admin = User::factory()->admin()->create(['is_active' => true]);
        $petugas = User::factory()->petugas()->create(['is_active' => true]);

        // 1. Guest ditolak 401 pada endpoint operasional maupun admin
        $this->getJson('/api/operational/access-check')->assertStatus(401);
        $this->getJson('/api/admin/access-check')->assertStatus(401);

        // 2. Petugas diizinkan (200) pada endpoint operasional
        $this->actingAs($petugas, 'sanctum')
            ->getJson('/api/operational/access-check')
            ->assertStatus(200)
            ->assertJsonPath('scope', 'operational')
            ->assertJsonPath('role', User::ROLE_PETUGAS);

        // 3. Petugas DITOLAK (403) pada endpoint khusus Admin (sesuai PRD Bagian 6)
        $this->actingAs($petugas, 'sanctum')
            ->getJson('/api/admin/access-check')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Akses ditolak. Anda tidak memiliki hak akses untuk fitur ini.');

        // 4. Admin diizinkan (200) pada endpoint operasional maupun endpoint khusus Admin
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/operational/access-check')
            ->assertStatus(200)
            ->assertJsonPath('role', User::ROLE_ADMIN);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/access-check')
            ->assertStatus(200)
            ->assertJsonPath('scope', 'admin')
            ->assertJsonPath('role', User::ROLE_ADMIN);
    }
}
