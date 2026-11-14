<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_PETUGAS = 'petugas';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Apakah pengguna memiliki role Admin (Staf Administrasi) (FR-002).
     */
    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /**
     * Apakah pengguna memiliki role Petugas Store/Security (FR-002).
     */
    public function isPetugas(): bool
    {
        return $this->role === self::ROLE_PETUGAS;
    }

    /**
     * Label role dalam Bahasa Indonesia sesuai persona PRD (Bagian 3).
     */
    public function roleLabel(): string
    {
        return match ($this->role) {
            self::ROLE_ADMIN => 'Staf Administrasi (Admin)',
            self::ROLE_PETUGAS => 'Petugas Store/Security',
            default => (string) $this->role,
        };
    }

    /**
     * Hanya Admin aktif yang berhak mengekspor riwayat transaksi ke PDF/Excel (FR-010).
     */
    public function canExportTransactions(): bool
    {
        return $this->is_active && $this->isAdmin();
    }

    /**
     * Hanya Admin aktif yang berhak mengubah atau menghapus (soft delete) transaksi (FR-011).
     */
    public function canManageTransactions(): bool
    {
        return $this->is_active && $this->isAdmin();
    }

    /**
     * Daftar kapabilitas/izin pengguna berdasarkan role dan status aktif sesuai PRD.
     *
     * @return array<string, bool>
     */
    public function permissions(): array
    {
        $active = (bool) $this->is_active;
        $admin = $active && $this->isAdmin();

        return [
            'can_manage_users' => $admin,
            'can_manage_work_types' => $admin,
            'can_create_transactions' => $active && ($this->isAdmin() || $this->isPetugas()),
            'can_view_transactions' => $active && ($this->isAdmin() || $this->isPetugas()),
            'can_manage_transactions' => $this->canManageTransactions(),
            'can_export_transactions' => $this->canExportTransactions(),
            'can_view_audit_logs' => $admin,
        ];
    }

    /**
     * Scope hanya akun yang aktif.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Transaksi yang dicatat oleh pengguna ini sebagai penerima (MASUK) atau pemberi (KELUAR).
     */
    public function recordedTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'recorded_by');
    }

    /**
     * Transaksi yang dibuat oleh pengguna ini.
     */
    public function createdTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'created_by');
    }

    /**
     * Transaksi yang terakhir diperbarui oleh pengguna ini.
     */
    public function updatedTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'updated_by');
    }

    /**
     * Log audit aksi perubahan/penghapusan yang dilakukan pengguna ini.
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }
}
