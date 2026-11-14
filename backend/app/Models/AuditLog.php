<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    public const ACTION_UPDATE = 'UPDATE';
    public const ACTION_DELETE = 'DELETE';
    public const ACTION_RESTORE = 'RESTORE';

    /**
     * Tabel audit_logs bersifat append-only dan hanya memiliki kolom `created_at`.
     */
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'transaction_id',
        'action',
        'old_values',
        'new_values',
        'description',
        'ip_address',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Pengguna (Admin) yang melakukan aksi perubahan atau penghapusan.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Transaksi yang diubah atau dihapus (termasuk transaksi yang sudah di-soft-delete).
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id')->withTrashed();
    }
}
