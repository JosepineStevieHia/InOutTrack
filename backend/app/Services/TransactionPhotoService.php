<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\TransactionPhoto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TransactionPhotoService
{
    private const MIME_EXTENSION_MAP = [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    /**
     * Aturan validasi item file foto tunggal (dipakai bersama oleh array & single upload).
     * Memeriksa ekstensi, MIME type nyata via fileinfo, ukuran <= 5 MB, dan integritas header gambar.
     *
     * @return array<int, string|\Closure>
     */
    private static function itemFileRules(): array
    {
        $maxKb = TransactionPhoto::MAX_FILE_SIZE_KB;
        $extensions = implode(',', TransactionPhoto::ALLOWED_EXTENSIONS);
        $mimes = implode(',', TransactionPhoto::ALLOWED_MIME_TYPES);

        return [
            'bail',
            'required',
            'file',
            'image',
            "mimes:{$extensions}",
            "mimetypes:{$mimes}",
            "max:{$maxKb}",
            function (string $attribute, mixed $value, \Closure $fail): void {
                if (! $value instanceof UploadedFile || ! $value->isValid()) {
                    $fail('File foto gagal diproses.');
                    return;
                }

                $realPath = $value->getRealPath();
                if (! $realPath || ! is_file($realPath)) {
                    $fail('File foto tidak ditemukan saat validasi.');
                    return;
                }

                $finfo = new \finfo(FILEINFO_MIME_TYPE);
                $detectedMime = null;

                try {
                    $detectedMime = @$finfo->file($realPath) ?: null;
                } catch (\Throwable) {
                    $detectedMime = null;
                }

                if ($detectedMime === null) {
                    $headerBytes = @file_get_contents($realPath, false, null, 0, 65536);
                    if (is_string($headerBytes) && $headerBytes !== '') {
                        try {
                            $detectedMime = @$finfo->buffer($headerBytes) ?: null;
                        } catch (\Throwable) {
                            $detectedMime = null;
                        }
                    }
                }

                if (! in_array($detectedMime, TransactionPhoto::ALLOWED_MIME_TYPES, true)) {
                    $fail('Format foto tidak valid. File harus berupa gambar JPG, JPEG, PNG, atau WEBP asli.');
                    return;
                }

                if (@getimagesize($realPath) === false) {
                    $fail('File foto rusak atau dimensi gambar tidak dapat dibaca.');
                }
            },
        ];
    }

    /**
     * Aturan validasi array foto transaksi (1-3 file, JPG/JPEG/PNG/WEBP, maks 5 MB).
     *
     * @return array<string, array<int, string|\Closure>>
     */
    public static function validationRules(string $field = 'photos', bool $required = true): array
    {
        $maxFiles = TransactionPhoto::MAX_PHOTOS_PER_TRANSACTION;

        $arrayRules = [
            $required ? 'required' : 'nullable',
            'array',
            "max:{$maxFiles}",
        ];

        if ($required) {
            array_splice($arrayRules, 2, 0, ['min:1']);
        }

        return [
            $field => $arrayRules,
            "{$field}.*" => self::itemFileRules(),
        ];
    }

    /**
     * Pesan error validasi array foto dalam Bahasa Indonesia.
     *
     * @return array<string, string>
     */
    public static function validationMessages(string $field = 'photos'): array
    {
        $maxFiles = TransactionPhoto::MAX_PHOTOS_PER_TRANSACTION;

        return [
            "{$field}.required" => 'Minimal satu foto barang wajib dilampirkan.',
            "{$field}.array" => 'Format daftar foto tidak valid.',
            "{$field}.min" => 'Minimal satu foto barang wajib dilampirkan.',
            "{$field}.max" => "Maksimal {$maxFiles} foto per transaksi.",
            "{$field}.*.required" => 'File foto tidak boleh kosong.',
            "{$field}.*.file" => 'Lampiran harus berupa file gambar yang valid.',
            "{$field}.*.image" => 'File harus berupa gambar yang valid.',
            "{$field}.*.mimes" => 'Format foto harus JPG, JPEG, PNG, atau WEBP.',
            "{$field}.*.mimetypes" => 'Tipe konten file foto tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.',
            "{$field}.*.max" => 'Ukuran setiap foto maksimal 5 MB.',
        ];
    }

    /**
     * Aturan validasi satu file foto (untuk ganti foto atau tambahan per slot).
     *
     * @return array<string, array<int, string|\Closure>>
     */
    public static function singleFileValidationRules(string $field = 'photo'): array
    {
        return [
            $field => self::itemFileRules(),
        ];
    }

    /**
     * Pesan error validasi satu file foto dalam Bahasa Indonesia.
     *
     * @return array<string, string>
     */
    public static function singleFileValidationMessages(string $field = 'photo'): array
    {
        return [
            "{$field}.required" => 'File foto pengganti wajib dipilih.',
            "{$field}.file" => 'Lampiran harus berupa file gambar yang valid.',
            "{$field}.image" => 'File harus berupa gambar yang valid.',
            "{$field}.mimes" => 'Format foto harus JPG, JPEG, PNG, atau WEBP.',
            "{$field}.mimetypes" => 'Tipe konten file foto tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.',
            "{$field}.max" => 'Ukuran foto maksimal 5 MB.',
        ];
    }

    /**
     * Hasilkan nama file aman dan unik bebas bentrok berdasarkan MIME terverifikasi.
     */
    public function generateSafeFilename(UploadedFile $file): string
    {
        $mimeType = $this->resolveMimeType($file);
        $extension = self::MIME_EXTENSION_MAP[$mimeType] ?? 'jpg';

        return now()->format('Ymd_His') . '_' . Str::lower((string) Str::ulid()) . '.' . $extension;
    }

    /**
     * Bersihkan nama file asli dari karakter berbahaya / path traversal agar aman disimpan di DB.
     */
    public function sanitizeOriginalName(string $originalName, string $fallbackExt = 'jpg'): string
    {
        $normalized = str_replace('\\', '/', $originalName);
        $base = basename($normalized);
        $clean = preg_replace('/[\x00-\x1F\x7F]/u', '', $base) ?? '';
        $clean = trim($clean);

        if ($clean === '' || $clean === '.' || $clean === '..') {
            return 'foto_transaksi.' . $fallbackExt;
        }

        if (mb_strlen($clean) <= 255) {
            return $clean;
        }

        $ext = pathinfo($clean, PATHINFO_EXTENSION);
        $suffix = $ext !== '' ? '.' . mb_substr($ext, 0, 10) : '';
        $stem = mb_substr(pathinfo($clean, PATHINFO_FILENAME), 0, 255 - mb_strlen($suffix));

        return $stem . $suffix;
    }

    /**
     * Simpan 1..3 foto untuk transaksi tertentu menggunakan Laravel Storage.
     *
     * @param  array<int, UploadedFile>  $files
     * @return Collection<int, TransactionPhoto>
     */
    public function storeForTransaction(
        Transaction $transaction,
        array $files,
        string $disk = 'public',
    ): Collection {
        $existingCount = $transaction->photos()->count();
        $incomingCount = count($files);
        $maxPhotos = TransactionPhoto::MAX_PHOTOS_PER_TRANSACTION;

        if ($incomingCount === 0) {
            throw ValidationException::withMessages([
                'photos' => ['Minimal satu foto barang wajib dilampirkan.'],
            ]);
        }

        if ($existingCount + $incomingCount > $maxPhotos) {
            throw ValidationException::withMessages([
                'photos' => ["Total foto per transaksi maksimal {$maxPhotos} foto (saat ini tersimpan {$existingCount} foto)."],
            ]);
        }

        $directory = 'transaction-photos/' . now()->format('Y/m');
        $writtenPaths = [];

        try {
            return DB::transaction(function () use ($transaction, $files, $disk, $directory, &$writtenPaths) {
                $created = collect();

                foreach ($files as $file) {
                    $mimeType = $this->resolveMimeType($file);
                    $fallbackExt = self::MIME_EXTENSION_MAP[$mimeType] ?? 'jpg';
                    $safeFilename = $this->generateSafeFilename($file);
                    $storedPath = Storage::disk($disk)->putFileAs($directory, $file, $safeFilename);

                    if (! is_string($storedPath) || $storedPath === '') {
                        throw new \RuntimeException('Gagal menulis file foto ke penyimpanan Laravel.');
                    }

                    $writtenPaths[] = $storedPath;

                    $photo = TransactionPhoto::create([
                        'transaction_id' => $transaction->id,
                        'file_path' => $storedPath,
                        'original_name' => $this->sanitizeOriginalName(
                            (string) $file->getClientOriginalName(),
                            $fallbackExt,
                        ),
                        'mime_type' => $mimeType,
                        'file_size' => (int) ($file->getSize() ?? 0),
                    ]);

                    $created->push($photo);
                }

                return $created;
            });
        } catch (\Throwable $e) {
            foreach ($writtenPaths as $path) {
                Storage::disk($disk)->delete($path);
            }

            throw $e;
        }
    }

    /**
     * Ganti foto transaksi yang sudah ada dengan file baru tanpa menyisakan file lama.
     */
    public function replacePhoto(
        TransactionPhoto $photo,
        UploadedFile $newFile,
        string $disk = 'public',
    ): TransactionPhoto {
        $directory = 'transaction-photos/' . now()->format('Y/m');
        $mimeType = $this->resolveMimeType($newFile);
        $fallbackExt = self::MIME_EXTENSION_MAP[$mimeType] ?? 'jpg';
        $safeFilename = $this->generateSafeFilename($newFile);

        $newPath = Storage::disk($disk)->putFileAs($directory, $newFile, $safeFilename);

        if (! is_string($newPath) || $newPath === '') {
            throw new \RuntimeException('Gagal menyimpan file foto pengganti ke penyimpanan.');
        }

        $oldPath = $photo->file_path;

        try {
            DB::transaction(function () use ($photo, $newPath, $newFile, $mimeType, $fallbackExt) {
                $photo->update([
                    'file_path' => $newPath,
                    'original_name' => $this->sanitizeOriginalName(
                        (string) $newFile->getClientOriginalName(),
                        $fallbackExt,
                    ),
                    'mime_type' => $mimeType,
                    'file_size' => (int) ($newFile->getSize() ?? 0),
                ]);
            });
        } catch (\Throwable $e) {
            Storage::disk($disk)->delete($newPath);
            throw $e;
        }

        if ($oldPath && $oldPath !== $newPath) {
            Storage::disk($disk)->delete($oldPath);
        }

        return $photo->fresh();
    }

    /**
     * Hapus foto dari transaksi, sambil menjaga aturan minimal 1 foto per transaksi tersimpan.
     */
    public function deletePhoto(TransactionPhoto $photo, string $disk = 'public'): void
    {
        $remainingCount = TransactionPhoto::query()
            ->where('transaction_id', $photo->transaction_id)
            ->count();

        if ($remainingCount <= 1) {
            throw ValidationException::withMessages([
                'photo' => ['Transaksi wajib memiliki minimal satu foto barang. Gunakan fitur ganti foto jika ingin menggantinya.'],
            ]);
        }

        $filePath = $photo->file_path;

        $photo->delete();

        if ($filePath) {
            Storage::disk($disk)->delete($filePath);
        }
    }

    public function resolveMimeType(UploadedFile $file): string
    {
        return (string) ($file->getMimeType() ?: $file->getClientMimeType() ?: 'image/jpeg');
    }
}
