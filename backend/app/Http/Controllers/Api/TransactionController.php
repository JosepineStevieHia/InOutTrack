<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Transaction\BaseStoreTransactionRequest;
use App\Http\Requests\Transaction\StoreInboundTransactionRequest;
use App\Http\Requests\Transaction\StoreOutboundTransactionRequest;
use App\Http\Requests\Transaction\UpdateTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Http\Resources\WorkTypeResource;
use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\User;
use App\Models\WorkType;
use App\Services\TransactionFilterService;
use App\Services\TransactionPhotoService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TransactionController extends Controller
{
    public function __construct(
        private readonly TransactionPhotoService $photoService,
        private readonly TransactionFilterService $filterService,
    ) {}

    /**
     * Daftar riwayat transaksi gabungan Barang Masuk dan Barang Keluar (FR-007, FR-008, FR-009).
     * Seluruh filter dikombinasikan dengan logika AND dan dieksekusi di backend.
     */
    public function index(Request $request): JsonResponse
    {
        $filteredQuery = $this->filterService->apply(Transaction::query(), $request);
        $summary = $this->filterService->computeSummary($filteredQuery);

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);

        $paginator = $filteredQuery
            ->with(['workType', 'recorder', 'photos'])
            ->orderByDesc('transaction_datetime')
            ->orderByDesc('id')
            ->paginate($perPage);

        $officers = User::query()
            ->select(['id', 'name', 'username', 'role', 'is_active'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'role' => $u->role,
                'is_active' => (bool) $u->is_active,
            ])
            ->values();

        $workTypes = WorkType::query()
            ->select(['id', 'name', 'is_active'])
            ->orderBy('name')
            ->get()
            ->map(fn (WorkType $wt) => [
                'id' => $wt->id,
                'name' => $wt->name,
                'is_active' => (bool) $wt->is_active,
            ])
            ->values();

        return response()->json([
            'data' => TransactionResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'summary' => $summary,
            'filter_options' => [
                'officers' => $officers,
                'work_types' => $workTypes,
            ],
        ]);
    }

    /**
     * Detail lengkap transaksi beserta daftar foto bukti (FR-007).
     */
    public function show(Request $request, Transaction $transaction): JsonResponse
    {
        $transaction->load(['workType', 'recorder', 'photos']);

        return response()->json([
            'transaction' => (new TransactionResource($transaction))->resolve($request),
        ]);
    }

    /**
     * Daftar jenis pekerjaan aktif untuk pilihan pada form transaksi (FR-013, FR-004, FR-005).
     */
    public function workTypes(Request $request): JsonResponse
    {
        $workTypes = WorkType::query()
            ->active()
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => WorkTypeResource::collection($workTypes)->resolve($request),
        ]);
    }

    /**
     * Simpan transaksi Barang Masuk (FR-004).
     * `recipient_name`, `recorded_by`, dan `created_by` diisi mutlak dari akun login (anti-spoofing).
     */
    public function storeInbound(StoreInboundTransactionRequest $request): JsonResponse
    {
        $transaction = $this->createTransaction($request, Transaction::TYPE_MASUK);

        return response()->json([
            'message' => 'Transaksi barang masuk berhasil disimpan.',
            'transaction' => (new TransactionResource($transaction))->resolve($request),
        ], 201);
    }

    /**
     * Simpan transaksi Barang Keluar (FR-005).
     * `giver_name`, `recorded_by`, dan `created_by` diisi mutlak dari akun login (anti-spoofing).
     */
    public function storeOutbound(StoreOutboundTransactionRequest $request): JsonResponse
    {
        $transaction = $this->createTransaction($request, Transaction::TYPE_KELUAR);

        return response()->json([
            'message' => 'Transaksi barang keluar berhasil disimpan.',
            'transaction' => (new TransactionResource($transaction))->resolve($request),
        ], 201);
    }

    /**
     * Perbarui data transaksi (termasuk perubahan foto) oleh Admin beserta pencatatan log audit (FR-011, FR-012).
     */
    public function update(UpdateTransactionRequest $request, Transaction $transaction): JsonResponse
    {
        $validated = $request->validated();
        $admin = $request->user();
        $timezone = (string) config('app.timezone', 'Asia/Jakarta');
        $transactionDatetime = Carbon::parse($validated['transaction_datetime'], $timezone)
            ->setTimezone($timezone);

        $oldValues = self::auditSnapshot($transaction);

        $rawDeleteIds = $validated['delete_photo_ids'] ?? [];
        $deleteIds = is_array($rawDeleteIds)
            ? array_values(array_unique(array_map('intval', $rawDeleteIds)))
            : [];

        $newFiles = array_values(array_filter(
            array_merge(
                is_array($request->file('new_photos')) ? $request->file('new_photos') : [],
                is_array($request->file('photos')) ? $request->file('photos') : [],
            ),
            fn (mixed $file): bool => $file instanceof UploadedFile,
        ));

        $pathsToDeleteFromDisk = [];

        $updatedTransaction = DB::transaction(function () use (
            $transaction,
            $validated,
            $admin,
            $transactionDatetime,
            $oldValues,
            $deleteIds,
            $newFiles,
            $request,
            &$pathsToDeleteFromDisk,
        ) {
            $payload = [
                'transaction_datetime' => $transactionDatetime,
                'item_name' => $validated['item_name'],
                'quantity' => $validated['quantity'],
                'unit' => $validated['unit'],
                'work_type_id' => (int) $validated['work_type_id'],
                'work_description' => $validated['work_description'] ?? null,
                'updated_by' => $admin->id,
            ];

            if ($transaction->isMasuk()) {
                $payload['origin'] = $validated['origin'];
                $payload['sender_name'] = $validated['sender_name'];
            } else {
                $payload['destination'] = $validated['destination'];
                $payload['taker_name'] = $validated['taker_name'];
            }

            $transaction->update($payload);

            if ($deleteIds !== []) {
                $photosToDelete = $transaction->photos()
                    ->whereIn('id', $deleteIds)
                    ->get();

                foreach ($photosToDelete as $photo) {
                    if ($photo->file_path) {
                        $pathsToDeleteFromDisk[] = $photo->file_path;
                    }
                    $photo->delete();
                }
            }

            if ($newFiles !== []) {
                $this->photoService->storeForTransaction($transaction, $newFiles);
            }

            $transaction->refresh();
            $newValues = self::auditSnapshot($transaction);

            $photosChanged = $deleteIds !== [] || $newFiles !== [];
            $description = $photosChanged
                ? 'Admin memperbarui data transaksi dan lampiran foto.'
                : 'Admin memperbarui data transaksi.';

            AuditLog::create([
                'user_id' => $admin->id,
                'transaction_id' => $transaction->id,
                'action' => AuditLog::ACTION_UPDATE,
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'description' => $description,
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);

            return $transaction->load(['workType', 'recorder', 'photos']);
        });

        foreach ($pathsToDeleteFromDisk as $oldPath) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'message' => 'Data transaksi berhasil diperbarui.',
            'transaction' => (new TransactionResource($updatedTransaction))->resolve($request),
        ]);
    }

    /**
     * Soft delete transaksi oleh Admin beserta pencatatan log audit (FR-011, FR-012).
     */
    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        $admin = $request->user();
        $oldValues = self::auditSnapshot($transaction);

        DB::transaction(function () use ($transaction, $admin, $oldValues, $request) {
            $transaction->updated_by = $admin->id;
            $transaction->save();
            $transaction->delete();

            AuditLog::create([
                'user_id' => $admin->id,
                'transaction_id' => $transaction->id,
                'action' => AuditLog::ACTION_DELETE,
                'old_values' => $oldValues,
                'new_values' => null,
                'description' => 'Admin menghapus (soft delete) data transaksi.',
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Transaksi berhasil dihapus.',
        ]);
    }

    private function createTransaction(BaseStoreTransactionRequest $request, string $type): Transaction
    {
        $validated = $request->validated();
        $user = $request->user();
        $timezone = (string) config('app.timezone', 'Asia/Jakarta');
        $transactionDatetime = Carbon::parse($validated['transaction_datetime'], $timezone)
            ->setTimezone($timezone);

        /** @var array<int, UploadedFile> $photos */
        $photos = $request->file('photos', []);
        $isInbound = $type === Transaction::TYPE_MASUK;

        return DB::transaction(function () use ($validated, $user, $type, $isInbound, $transactionDatetime, $photos) {
            $transaction = Transaction::create([
                'type' => $type,
                'transaction_datetime' => $transactionDatetime,
                'item_name' => $validated['item_name'],
                'quantity' => $validated['quantity'],
                'unit' => $validated['unit'],
                'work_type_id' => (int) $validated['work_type_id'],
                'work_description' => $validated['work_description'] ?? null,
                'origin' => $isInbound ? $validated['origin'] : null,
                'destination' => $isInbound ? null : $validated['destination'],
                'sender_name' => $isInbound ? $validated['sender_name'] : null,
                'recipient_name' => $isInbound ? $user->name : null,
                'taker_name' => $isInbound ? null : $validated['taker_name'],
                'giver_name' => $isInbound ? null : $user->name,
                'recorded_by' => $user->id,
                'created_by' => $user->id,
                'updated_by' => null,
            ]);

            $this->photoService->storeForTransaction($transaction, $photos);

            return $transaction->load(['workType', 'recorder', 'photos']);
        });
    }

    /**
     * Bentuk snapshot lengkap transaksi beserta daftar foto untuk pencatatan Audit Log.
     *
     * @return array<string, mixed>
     */
    public static function auditSnapshot(Transaction $transaction): array
    {
        $transaction->load([
            'workType',
            'photos' => fn ($query) => $query->orderBy('id'),
        ]);

        return [
            'type' => $transaction->type,
            'transaction_datetime' => $transaction->transaction_datetime?->toIso8601String(),
            'item_name' => $transaction->item_name,
            'quantity' => (float) $transaction->quantity,
            'unit' => $transaction->unit,
            'work_type_id' => $transaction->work_type_id,
            'work_type_name' => $transaction->workType?->name,
            'work_description' => $transaction->work_description,
            'origin' => $transaction->origin,
            'destination' => $transaction->destination,
            'sender_name' => $transaction->sender_name,
            'recipient_name' => $transaction->recipient_name,
            'taker_name' => $transaction->taker_name,
            'giver_name' => $transaction->giver_name,
            'recorded_by' => $transaction->recorded_by,
            'deleted_at' => $transaction->deleted_at?->toIso8601String(),
            'photos' => $transaction->photos
                ->map(fn (TransactionPhoto $photo): array => [
                    'id' => $photo->id,
                    'original_name' => $photo->original_name,
                    'file_path' => $photo->file_path,
                    'mime_type' => $photo->mime_type,
                    'file_size' => (int) $photo->file_size,
                ])
                ->values()
                ->all(),
        ];
    }
}
