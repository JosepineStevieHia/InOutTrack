<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkTypeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_and_petugas_cannot_access_work_type_endpoints(): void
    {
        $petugas = User::factory()->petugas()->create();
        $workType = WorkType::create([
            'name' => 'Instalasi Kabel',
            'description' => 'Pemasangan jaringan',
            'is_active' => true,
        ]);

        $this->getJson('/api/admin/work-types')->assertStatus(401);

        Sanctum::actingAs($petugas);

        $this->getJson('/api/admin/work-types')->assertStatus(403);
        $this->postJson('/api/admin/work-types', [
            'name' => 'Baru',
            'description' => 'Deskripsi',
        ])->assertStatus(403);
        $this->getJson("/api/admin/work-types/{$workType->id}")->assertStatus(403);
        $this->putJson("/api/admin/work-types/{$workType->id}", [
            'name' => 'Ubah',
            'description' => 'Deskripsi',
            'is_active' => true,
        ])->assertStatus(403);
        $this->patchJson("/api/admin/work-types/{$workType->id}/status", ['is_active' => false])->assertStatus(403);
    }

    public function test_admin_can_list_search_filter_create_update_and_toggle_work_types(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        // Tambah jenis pekerjaan
        $createResponse = $this->postJson('/api/admin/work-types', [
            'name' => 'Perbaikan Panel Listrik',
            'description' => 'Pekerjaan pemeliharaan panel distribusi utama.',
            'is_active' => true,
        ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('message', 'Jenis pekerjaan berhasil ditambahkan.')
            ->assertJsonPath('work_type.name', 'Perbaikan Panel Listrik')
            ->assertJsonPath('work_type.is_active', true);

        $workTypeId = $createResponse->json('work_type.id');

        // Duplikat nama ditolak
        $this->postJson('/api/admin/work-types', [
            'name' => 'Perbaikan Panel Listrik',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // Ubah jenis pekerjaan
        $this->putJson("/api/admin/work-types/{$workTypeId}", [
            'name' => 'Pemeliharaan Panel LVMDP',
            'description' => 'Panel listrik tegangan rendah.',
            'is_active' => true,
        ])->assertStatus(200)
            ->assertJsonPath('work_type.name', 'Pemeliharaan Panel LVMDP');

        // Nonaktifkan jenis pekerjaan
        $this->patchJson("/api/admin/work-types/{$workTypeId}/status", [
            'is_active' => false,
        ])->assertStatus(200)
            ->assertJsonPath('work_type.is_active', false);

        // Filter inactive & search
        $this->getJson('/api/admin/work-types?search=LVMDP&status=inactive')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Pemeliharaan Panel LVMDP')
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.inactive', 1);

        // Aktifkan kembali
        $this->patchJson("/api/admin/work-types/{$workTypeId}/status", [
            'is_active' => true,
        ])->assertStatus(200)
            ->assertJsonPath('work_type.is_active', true);
    }
}
