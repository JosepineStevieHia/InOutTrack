<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class TransactionPhoto extends Model
{
    use HasFactory;

    public const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (PRD Bagian 6)
    public const MAX_PHOTOS_PER_TRANSACTION = 3;        // Maks 3 foto (PRD Bagian 6)
    public const ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp',
    ];

    protected $fillable = [
        'transaction_id',
        'file_path',
        'original_name',
        'mime_type',
        'file_size',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
        ];
    }

    /**
     * Transaksi induk dari foto ini (termasuk jika sudah di-soft-delete).
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id')->withTrashed();
    }

    /**
     * URL publik untuk menampilkan foto dari disk public Laravel.
     */
    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->file_path);
    }
}
