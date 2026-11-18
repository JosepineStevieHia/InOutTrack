<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Daftar log audit perubahan dan penghapusan transaksi khusus Admin (FR-012).
     * Seluruh pencarian, filter, ringkasan, dan pagination 20 data/halaman dijalankan di backend.
     */
    public function index(Request $request): JsonResponse
    {
        $filteredQuery = $this->applyFilters(AuditLog::query(), $request);

        $summaryRow = (clone $filteredQuery)
            ->selectRaw(
                'COUNT(*) as total_count, '
                . 'COALESCE(SUM(CASE WHEN action = ? THEN 1 ELSE 0 END), 0) as update_count, '
                . 'COALESCE(SUM(CASE WHEN action = ? THEN 1 ELSE 0 END), 0) as delete_count',
                [AuditLog::ACTION_UPDATE, AuditLog::ACTION_DELETE],
            )
            ->first();

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);

        $paginator = $filteredQuery
            ->with(['user', 'transaction'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        $users = User::query()
            ->where(function (Builder $query): void {
                $query->where('role', User::ROLE_ADMIN)
                    ->orWhereIn('id', AuditLog::query()->select('user_id')->distinct());
            })
            ->select(['id', 'name', 'username', 'role', 'is_active'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'role' => $user->role,
                'is_active' => (bool) $user->is_active,
            ])
            ->values();

        return response()->json([
            'data' => AuditLogResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'summary' => [
                'total' => (int) ($summaryRow->total_count ?? 0),
                'update_count' => (int) ($summaryRow->update_count ?? 0),
                'delete_count' => (int) ($summaryRow->delete_count ?? 0),
            ],
            'filter_options' => [
                'users' => $users,
            ],
        ]);
    }

    /**
     * Detail satu entri log audit termasuk data sebelum dan sesudah perubahan (FR-012).
     */
    public function show(Request $request, AuditLog $auditLog): JsonResponse
    {
        $auditLog->load(['user', 'transaction']);

        return response()->json([
            'audit_log' => (new AuditLogResource($auditLog))->resolve($request),
        ]);
    }

    private function applyFilters(Builder $query, Request $request): Builder
    {
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $numericSearch = ltrim($search, '#');

            $query->where(function (Builder $q) use ($search, $numericSearch): void {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhereHas('user', function (Builder $userQ) use ($search): void {
                        $userQ->where('name', 'like', "%{$search}%")
                            ->orWhere('username', 'like', "%{$search}%");
                    })
                    ->orWhereHas('transaction', function (Builder $txQ) use ($search): void {
                        $txQ->withTrashed()->where('item_name', 'like', "%{$search}%");
                    });

                if (ctype_digit($numericSearch)) {
                    $q->orWhere('transaction_id', (int) $numericSearch)
                        ->orWhere('id', (int) $numericSearch);
                }
            });
        }

        $action = strtoupper(trim((string) $request->query('action', '')));
        if (in_array($action, [AuditLog::ACTION_UPDATE, AuditLog::ACTION_DELETE, AuditLog::ACTION_RESTORE], true)) {
            $query->where('action', $action);
        }

        $userId = trim((string) $request->query('user_id', ''));
        if ($userId !== '' && ctype_digit($userId)) {
            $query->where('user_id', (int) $userId);
        }

        $transactionId = trim((string) $request->query('transaction_id', ''));
        if ($transactionId !== '' && ctype_digit($transactionId)) {
            $query->where('transaction_id', (int) $transactionId);
        }

        $timezone = (string) config('app.timezone', 'Asia/Jakarta');

        $dateFrom = trim((string) $request->query('date_from', ''));
        if ($dateFrom !== '') {
            try {
                $start = Carbon::parse($dateFrom, $timezone)->startOfDay()->setTimezone($timezone);
                $query->where('created_at', '>=', $start);
            } catch (\Throwable) {
                // Abaikan format tanggal tidak valid.
            }
        }

        $dateTo = trim((string) $request->query('date_to', ''));
        if ($dateTo !== '') {
            try {
                $end = Carbon::parse($dateTo, $timezone)->endOfDay()->setTimezone($timezone);
                $query->where('created_at', '<=', $end);
            } catch (\Throwable) {
                // Abaikan format tanggal tidak valid.
            }
        }

        return $query;
    }
}
