<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Transaction extends Model
{
    use HasFactory, SoftDeletes;

    public const TYPE_MASUK = 'MASUK';
    public const TYPE_KELUAR = 'KELUAR';

    protected $fillable = [
        'type',
        'transaction_datetime',
        'item_name',
        'quantity',
        'unit',
        'work_type_id',
        'work_description',
        'origin',
        'destination',
        'sender_name',
        'recipient_name',
        'taker_name',
        'giver_name',
        'recorded_by',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'transaction_datetime' => 'datetime',
            'quantity' => 'decimal:2',
            'deleted_at' => 'datetime',
        ];
    }

    public function isMasuk(): bool
    {
        return $this->type === self::TYPE_MASUK;
    }

    public function isKeluar(): bool
    {
        return $this->type === self::TYPE_KELUAR;
    }

    public function scopeMasuk(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_MASUK);
    }

    public function scopeKeluar(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_KELUAR);
    }

    /**
     * Jenis pekerjaan terkait transaksi ini.
     */
    public function workType(): BelongsTo
    {
        return $this->belongsTo(WorkType::class, 'work_type_id');
    }

    /**
     * Akun petugas penerima (pada MASUK) atau pemberi (pada KELUAR).
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Akun pengguna yang membuat transaksi.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Akun Admin yang terakhir mengubah transaksi.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Daftar foto bukti transaksi (1-3 foto).
     */
    public function photos(): HasMany
    {
        return $this->hasMany(TransactionPhoto::class, 'transaction_id');
    }

    /**
     * Riwayat log audit atas perubahan/penghapusan transaksi ini.
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'transaction_id');
    }
}
