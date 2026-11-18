<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreWorkTypeRequest;
use App\Http\Requests\Admin\UpdateWorkTypeRequest;
use App\Http\Resources\WorkTypeResource;
use App\Models\WorkType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);

        $query = WorkType::query()
            ->withCount('transactions')
            ->orderByDesc('is_active')
            ->orderBy('name');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($subQuery) use ($like) {
                $subQuery->where('name', 'like', $like)
                    ->orWhere('description', 'like', $like);
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $paginator = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => WorkTypeResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'summary' => [
                'total' => WorkType::query()->count(),
                'active' => WorkType::query()->where('is_active', true)->count(),
                'inactive' => WorkType::query()->where('is_active', false)->count(),
            ],
        ]);
    }

    public function store(StoreWorkTypeRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $workType = WorkType::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        $workType->loadCount('transactions');

        return response()->json([
            'message' => 'Jenis pekerjaan berhasil ditambahkan.',
            'work_type' => (new WorkTypeResource($workType))->resolve($request),
        ], 201);
    }

    public function show(Request $request, WorkType $workType): JsonResponse
    {
        $workType->loadCount('transactions');

        return response()->json([
            'work_type' => (new WorkTypeResource($workType))->resolve($request),
        ]);
    }

    public function update(UpdateWorkTypeRequest $request, WorkType $workType): JsonResponse
    {
        $validated = $request->validated();

        $workType->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => (bool) $validated['is_active'],
        ]);

        $workType->loadCount('transactions');

        return response()->json([
            'message' => 'Jenis pekerjaan berhasil diperbarui.',
            'work_type' => (new WorkTypeResource($workType))->resolve($request),
        ]);
    }

    public function updateStatus(Request $request, WorkType $workType): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ], [
            'is_active.required' => 'Status aktif jenis pekerjaan wajib diisi.',
            'is_active.boolean' => 'Status aktif jenis pekerjaan harus berupa nilai boolean.',
        ]);

        $nextActive = (bool) $validated['is_active'];
        $workType->update(['is_active' => $nextActive]);
        $workType->loadCount('transactions');

        return response()->json([
            'message' => $nextActive
                ? 'Jenis pekerjaan berhasil diaktifkan kembali.'
                : 'Jenis pekerjaan berhasil dinonaktifkan.',
            'work_type' => (new WorkTypeResource($workType))->resolve($request),
        ]);
    }
}
