<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Menyesuaikan tabel `users` bawaan Laravel dengan kebutuhan PRD InOutTrack:
     * - username unik (untuk login menggunakan username/email - FR-001, Bagian 8.6)
     * - email opsional/nullable (Bagian 12)
     * - role: 'admin' (Staf Administrasi) atau 'petugas' (Petugas Store/Security) (FR-002)
     * - is_active: status aktif/nonaktif akun (FR-003, Bagian 6)
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 50)->unique()->after('name');
            $table->string('email')->nullable()->change();
            $table->enum('role', ['admin', 'petugas'])->default('petugas')->after('password');
            $table->boolean('is_active')->default(true)->after('role');

            $table->index(['role', 'is_active'], 'idx_users_role_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_role_active');
            $table->dropUnique(['username']);
            $table->dropColumn(['username', 'role', 'is_active']);
            $table->string('email')->nullable(false)->change();
        });
    }
};
