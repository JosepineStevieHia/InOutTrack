<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Photo\ReplaceTransactionPhotoRequest;
use App\Http\Requests\Photo\StoreTransactionPhotosRequest;
use App\Http\Resources\TransactionPhotoResource;
use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Services\TransactionPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class TransactionPhotoController extends Controller
{
    public function __construct(
        private readonly TransactionPhotoService $photoService,
    ) {}

    /**
     * Endpoint uji validasi foto sebelum transaksi penuh disimpan (Tahap 6):
     * memvalidasi format/ukuran/batas file dan menguji tulis-hapus aman ke Laravel Storage.
     */
    public function validateUpload(StoreTransactionPhotosRequest $request): JsonResponse
    {
        /** @var array<int, UploadedFile> $files */
        $files = $request->file('photos', []);
        $disk = 'public';
        $tempDir = 'transaction-photos/verify-temp';
        $targetDir = 'transaction-photos/' . now()->format('Y/m');

        $validatedItems = [];
        $writtenTempPaths = [];

        try {
            foreach ($files as $file) {
                $mimeType = $this->photoService->resolveMimeType($file);
                $safeFilename = $this->photoService->generateSafeFilename($file);
                $tempPath = Storage::disk($disk)->putFileAs($tempDir, $file, $safeFilename);

                if (! is_string($tempPath) || ! Storage::disk($disk)->exists($tempPath)) {
                    return response()->json([
                        'message' => 'Gagal memverifikasi penulisan file ke Laravel Storage.',
                    ], 500);
                }

                $writtenTempPaths[] = $tempPath;

                $validatedItems[] = [
                    'original_name' => $this->photoService->sanitizeOriginalName(
                        (string) $file->getClientOriginalName(),
                    ),
                    'safe_filename' => $safeFilename,
                    'simulated_path' => "{$targetDir}/{$safeFilename}",
                    'mime_type' => $mimeType,
                    'file_size' => (int) ($file->getSize() ?? 0),
                ];
            }
        } finally {
            foreach ($writtenTempPaths as $path) {
                Storage::disk($disk)->delete($path);
            }
        }

        $count = count($validatedItems);

        return response()->json([
            'message' => "{$count} foto lolos validasi format, ukuran, dan uji penyimpanan Laravel Storage.",
            'count' => $count,
            'photos' => $validatedItems,
        ]);
    }

    public function index(Request $request, Transaction $transaction): JsonResponse
    {
        $photos = $transaction->photos()->orderBy('id')->get();

        return response()->json([
            'data' => TransactionPhotoResource::collection($photos)->resolve($request),
        ]);
    }

    public function store(StoreTransactionPhotosRequest $request, Transaction $transaction): JsonResponse
    {
        $oldValues = TransactionController::auditSnapshot($transaction);

        /** @var array<int, UploadedFile> $files */
        $files = $request->file('photos', []);
        $created = $this->photoService->storeForTransaction($transaction, $files);

        $newValues = TransactionController::auditSnapshot($transaction);
        $this->recordPhotoAudit($request, $transaction, $oldValues, $newValues, 'Menambah foto transaksi.');

        return response()->json([
            'message' => 'Foto transaksi berhasil diunggah dan disimpan.',
            'photos' => TransactionPhotoResource::collection($created)->resolve($request),
        ], 201);
    }

    public function replace(
        ReplaceTransactionPhotoRequest $request,
        TransactionPhoto $transactionPhoto,
    ): JsonResponse {
        $transaction = $transactionPhoto->transaction;
        $oldValues = $transaction ? TransactionController::auditSnapshot($transaction) : null;

        /** @var UploadedFile $file */
        $file = $request->file('photo');
        $updated = $this->photoService->replacePhoto($transactionPhoto, $file);

        if ($transaction && $oldValues !== null) {
            $newValues = TransactionController::auditSnapshot($transaction);
            $this->recordPhotoAudit($request, $transaction, $oldValues, $newValues, 'Mengganti foto transaksi.');
        }

        return response()->json([
            'message' => 'Foto transaksi berhasil diganti.',
            'photo' => (new TransactionPhotoResource($updated))->resolve($request),
        ]);
    }

    public function destroy(Request $request, TransactionPhoto $transactionPhoto): JsonResponse
    {
        $transaction = $transactionPhoto->transaction;
        $oldValues = $transaction ? TransactionController::auditSnapshot($transaction) : null;

        $this->photoService->deletePhoto($transactionPhoto);

        if ($transaction && $oldValues !== null) {
            $newValues = TransactionController::auditSnapshot($transaction);
            $this->recordPhotoAudit($request, $transaction, $oldValues, $newValues, 'Menghapus foto transaksi.');
        }

        return response()->json([
            'message' => 'Foto transaksi berhasil dihapus.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $oldValues
     * @param  array<string, mixed>  $newValues
     */
    private function recordPhotoAudit(
        Request $request,
        Transaction $transaction,
        array $oldValues,
        array $newValues,
        string $description,
    ): void {
        $user = $request->user();
        if (! $user) {
            return;
        }

        AuditLog::create([
            'user_id' => $user->id,
            'transaction_id' => $transaction->id,
            'action' => AuditLog::ACTION_UPDATE,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'description' => $description,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
