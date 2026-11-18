<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UserManagementController extends Controller
{
    /**
     * Hitung relasi transaksi (termasuk soft-deleted) dan audit log untuk keamanan hapus akun (PRD Bagian 6 & 12).
     *
     * @return array<int|string, mixed>
     */
    private function relationCountsConfig(): array
    {
        return [
            'recordedTransactions as recorded_transactions_count' => fn ($query) => $query->withTrashed(),
            'createdTransactions as created_transactions_count' => fn ($query) => $query->withTrashed(),
            'updatedTransactions as updated_transactions_count' => fn ($query) => $query->withTrashed(),
            'auditLogs',
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $role = trim((string) $request->query('role', ''));
        $status = trim((string) $request->query('status', ''));
        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);

        $query = User::query()
            ->withCount($this->relationCountsConfig())
            ->orderByDesc('is_active')
            ->orderBy('name');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($subQuery) use ($like) {
                $subQuery->where('name', 'like', $like)
                    ->orWhere('username', 'like', $like)
                    ->orWhere('email', 'like', $like);
            });
        }

        if (in_array($role, [User::ROLE_ADMIN, User::ROLE_PETUGAS], true)) {
            $query->where('role', $role);
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $paginator = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => UserResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'summary' => [
                'total' => User::query()->count(),
                'active' => User::query()->where('is_active', true)->count(),
                'inactive' => User::query()->where('is_active', false)->count(),
                'admin' => User::query()->where('role', User::ROLE_ADMIN)->count(),
                'petugas' => User::query()->where('role', User::ROLE_PETUGAS)->count(),
                'active_admins' => $this->activeAdminCount(),
            ],
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'username' => $validated['username'],
            'email' => $validated['email'] ?? null,
            'password' => $validated['password'],
            'role' => $validated['role'],
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        $user->loadCount($this->relationCountsConfig());

        return response()->json([
            'message' => 'Akun pengguna berhasil ditambahkan.',
            'user' => (new UserResource($user))->resolve($request),
        ], 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $user->loadCount($this->relationCountsConfig());

        return response()->json([
            'user' => (new UserResource($user))->resolve($request),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();
        $actor = $request->user();
        $nextRole = $validated['role'];
        $nextActive = (bool) $validated['is_active'];

        if ($actor && $actor->id === $user->id) {
            if (! $nextActive) {
                return response()->json([
                    'message' => 'Anda tidak dapat menonaktifkan akun yang sedang digunakan untuk login.',
                ], 422);
            }

            if ($nextRole !== User::ROLE_ADMIN) {
                return response()->json([
                    'message' => 'Anda tidak dapat menurunkan role akun Anda sendiri.',
                ], 422);
            }
        }

        if ($this->wouldRemoveLastActiveAdmin($user, $nextRole, $nextActive)) {
            return response()->json([
                'message' => 'Minimal harus ada satu akun Admin aktif dalam sistem.',
            ], 422);
        }

        $payload = [
            'name' => $validated['name'],
            'username' => $validated['username'],
            'email' => $validated['email'] ?? null,
            'role' => $nextRole,
            'is_active' => $nextActive,
        ];

        if (! empty($validated['password'])) {
            $payload['password'] = $validated['password'];
        }

        $wasActive = (bool) $user->is_active;
        $user->update($payload);

        if ($wasActive && ! $nextActive) {
            $this->revokeUserSessions($user);
        }

        $user->loadCount($this->relationCountsConfig());

        return response()->json([
            'message' => 'Data akun pengguna berhasil diperbarui.',
            'user' => (new UserResource($user))->resolve($request),
        ]);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ], [
            'is_active.required' => 'Status aktif akun wajib diisi.',
            'is_active.boolean' => 'Status aktif akun harus berupa nilai boolean.',
        ]);

        $nextActive = (bool) $validated['is_active'];
        $actor = $request->user();

        if ($actor && $actor->id === $user->id && ! $nextActive) {
            return response()->json([
                'message' => 'Anda tidak dapat menonaktifkan akun yang sedang digunakan untuk login.',
            ], 422);
        }

        if ($this->wouldRemoveLastActiveAdmin($user, $user->role, $nextActive)) {
            return response()->json([
                'message' => 'Minimal harus ada satu akun Admin aktif dalam sistem.',
            ], 422);
        }

        $user->update(['is_active' => $nextActive]);

        if (! $nextActive) {
            $this->revokeUserSessions($user);
        }

        $user->loadCount($this->relationCountsConfig());

        return response()->json([
            'message' => $nextActive
                ? 'Akun pengguna berhasil diaktifkan kembali.'
                : 'Akun pengguna berhasil dinonaktifkan.',
            'user' => (new UserResource($user))->resolve($request),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();

        if ($actor && $actor->id === $user->id) {
            return response()->json([
                'message' => 'Anda tidak dapat menghapus akun yang sedang digunakan untuk login.',
            ], 422);
        }

        if ($user->isAdmin() && $user->is_active && $this->otherActiveAdminCount($user->id) === 0) {
            return response()->json([
                'message' => 'Minimal harus ada satu akun Admin aktif dalam sistem.',
            ], 422);
        }

        $user->loadCount($this->relationCountsConfig());
        $linkedCount = (int) $user->recorded_transactions_count
            + (int) $user->created_transactions_count
            + (int) $user->updated_transactions_count
            + (int) $user->audit_logs_count;

        if ($linkedCount > 0) {
            return response()->json([
                'message' => 'Akun pengguna tidak dapat dihapus permanen karena memiliki riwayat transaksi atau log aktivitas. Silakan nonaktifkan akun ini.',
            ], 422);
        }

        DB::transaction(function () use ($user) {
            $this->revokeUserSessions($user);
            $user->delete();
        });

        return response()->json([
            'message' => 'Akun pengguna berhasil dihapus secara permanen.',
        ]);
    }

    private function activeAdminCount(): int
    {
        return User::query()
            ->where('role', User::ROLE_ADMIN)
            ->where('is_active', true)
            ->count();
    }

    private function otherActiveAdminCount(int $excludeUserId): int
    {
        return User::query()
            ->where('role', User::ROLE_ADMIN)
            ->where('is_active', true)
            ->where('id', '!=', $excludeUserId)
            ->count();
    }

    private function wouldRemoveLastActiveAdmin(User $user, string $nextRole, bool $nextActive): bool
    {
        if (! $user->isAdmin() || ! $user->is_active) {
            return false;
        }

        $staysActiveAdmin = $nextRole === User::ROLE_ADMIN && $nextActive;

        if ($staysActiveAdmin) {
            return false;
        }

        return $this->otherActiveAdminCount($user->id) === 0;
    }

    private function revokeUserSessions(User $user): void
    {
        if (Schema::hasTable('personal_access_tokens')) {
            $user->tokens()->delete();
        }

        if (config('session.driver') === 'database' && Schema::hasTable(config('session.table', 'sessions'))) {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->delete();
        }
    }
}
