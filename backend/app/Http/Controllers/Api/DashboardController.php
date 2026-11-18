<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use App\Services\TransactionFilterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private readonly TransactionFilterService $filterService,
    ) {}

    /**
     * Ringkasan transaksi Dashboard berdasarkan periode terpilih (FR-009, Bagian 8.5).
     */
    public function summary(Request $request): JsonResponse
    {
        $filteredQuery = $this->filterService->apply(Transaction::query(), $request);
        $summary = $this->filterService->computeSummary($filteredQuery);
        $meta = $this->filterService->describePeriodAndFilters($request);

        $recent = (clone $filteredQuery)
            ->with(['workType', 'recorder', 'photos'])
            ->orderByDesc('transaction_datetime')
            ->orderByDesc('id')
            ->limit(5)
            ->get();

        return response()->json([
            'summary' => $summary,
            'period' => [
                'date_from' => $meta['date_from'],
                'date_to' => $meta['date_to'],
                'label' => $meta['period_label'],
            ],
            'recent_transactions' => TransactionResource::collection($recent)->resolve($request),
        ]);
    }
}
