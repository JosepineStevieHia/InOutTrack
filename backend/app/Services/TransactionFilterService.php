<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\User;
use App\Models\WorkType;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class TransactionFilterService
{
    private const MONTH_NAMES_ID = [
        1 => 'Jan',
        2 => 'Feb',
        3 => 'Mar',
        4 => 'Apr',
        5 => 'Mei',
        6 => 'Jun',
        7 => 'Jul',
        8 => 'Agu',
        9 => 'Sep',
        10 => 'Okt',
        11 => 'Nov',
        12 => 'Des',
    ];

    /**
     * Terapkan seluruh kriteria pencarian dan filter ke query transaksi dengan logika AND.
     */
    public function apply(Builder $query, Request $request): Builder
    {
        $timezone = (string) config('app.timezone', 'Asia/Jakarta');

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $like = '%' . $this->escapeLike($search) . '%';
            $query->where(function (Builder $q) use ($like) {
                $q->where('item_name', 'like', $like)
                    ->orWhere('work_description', 'like', $like)
                    ->orWhere('origin', 'like', $like)
                    ->orWhere('destination', 'like', $like)
                    ->orWhere('sender_name', 'like', $like)
                    ->orWhere('recipient_name', 'like', $like)
                    ->orWhere('taker_name', 'like', $like)
                    ->orWhere('giver_name', 'like', $like)
                    ->orWhereHas('workType', function (Builder $wt) use ($like) {
                        $wt->where('name', 'like', $like);
                    })
                    ->orWhereHas('recorder', function (Builder $rec) use ($like) {
                        $rec->where('name', 'like', $like)
                            ->orWhere('username', 'like', $like);
                    });
            });
        }

        $itemName = trim((string) $request->query('item_name', ''));
        if ($itemName !== '') {
            $query->where('item_name', 'like', '%' . $this->escapeLike($itemName) . '%');
        }

        $recordedBy = $request->query('recorded_by');
        if ($recordedBy !== null && $recordedBy !== '' && ctype_digit((string) $recordedBy)) {
            $query->where('recorded_by', (int) $recordedBy);
        }

        $type = strtoupper(trim((string) $request->query('type', '')));
        if (in_array($type, [Transaction::TYPE_MASUK, Transaction::TYPE_KELUAR], true)) {
            $query->where('type', $type);
        }

        $workTypeId = $request->query('work_type_id');
        if ($workTypeId !== null && $workTypeId !== '' && ctype_digit((string) $workTypeId)) {
            $query->where('work_type_id', (int) $workTypeId);
        }

        $dateFrom = $this->parseDate($request->query('date_from'), $timezone);
        if ($dateFrom !== null) {
            $query->where('transaction_datetime', '>=', $dateFrom->copy()->startOfDay());
        }

        $dateTo = $this->parseDate($request->query('date_to'), $timezone);
        if ($dateTo !== null) {
            $query->where('transaction_datetime', '<=', $dateTo->copy()->endOfDay());
        }

        return $query;
    }

    /**
     * Hitung ringkasan total, barang masuk, dan barang keluar berdasarkan query yang sudah difilter.
     *
     * @return array{total: int, masuk: int, keluar: int}
     */
    public function computeSummary(Builder $filteredQuery): array
    {
        return [
            'total' => (clone $filteredQuery)->count(),
            'masuk' => (clone $filteredQuery)->where('type', Transaction::TYPE_MASUK)->count(),
            'keluar' => (clone $filteredQuery)->where('type', Transaction::TYPE_KELUAR)->count(),
        ];
    }

    /**
     * Buat deskripsi periode dan daftar filter aktif yang mudah dibaca untuk Dashboard & Ekspor.
     *
     * @return array{
     *     date_from: ?string,
     *     date_to: ?string,
     *     period_label: string,
     *     active_filters: array<int, string>
     * }
     */
    public function describePeriodAndFilters(Request $request): array
    {
        $timezone = (string) config('app.timezone', 'Asia/Jakarta');

        $rawFrom = is_string($request->query('date_from')) ? trim((string) $request->query('date_from')) : '';
        $rawTo = is_string($request->query('date_to')) ? trim((string) $request->query('date_to')) : '';

        $parsedFrom = $this->parseDate($rawFrom, $timezone);
        $parsedTo = $this->parseDate($rawTo, $timezone);

        if ($parsedFrom && $parsedTo) {
            $periodLabel = $this->formatIndonesianDate($parsedFrom) . ' s.d. ' . $this->formatIndonesianDate($parsedTo);
        } elseif ($parsedFrom) {
            $periodLabel = 'Mulai ' . $this->formatIndonesianDate($parsedFrom);
        } elseif ($parsedTo) {
            $periodLabel = 'Sampai ' . $this->formatIndonesianDate($parsedTo);
        } else {
            $periodLabel = 'Semua Periode';
        }

        $activeFilters = [];

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $activeFilters[] = 'Pencarian: "' . $search . '"';
        }

        $itemName = trim((string) $request->query('item_name', ''));
        if ($itemName !== '') {
            $activeFilters[] = 'Nama Barang: "' . $itemName . '"';
        }

        $type = strtoupper(trim((string) $request->query('type', '')));
        if ($type === Transaction::TYPE_MASUK) {
            $activeFilters[] = 'Jenis Transaksi: Barang Masuk';
        } elseif ($type === Transaction::TYPE_KELUAR) {
            $activeFilters[] = 'Jenis Transaksi: Barang Keluar';
        }

        $recordedBy = $request->query('recorded_by');
        if ($recordedBy !== null && $recordedBy !== '' && ctype_digit((string) $recordedBy)) {
            $officer = User::query()->find((int) $recordedBy);
            $activeFilters[] = 'Petugas: ' . ($officer?->name ?? '#' . $recordedBy);
        }

        $workTypeId = $request->query('work_type_id');
        if ($workTypeId !== null && $workTypeId !== '' && ctype_digit((string) $workTypeId)) {
            $workType = WorkType::query()->find((int) $workTypeId);
            $activeFilters[] = 'Jenis Pekerjaan: ' . ($workType?->name ?? '#' . $workTypeId);
        }

        return [
            'date_from' => $parsedFrom?->format('Y-m-d'),
            'date_to' => $parsedTo?->format('Y-m-d'),
            'period_label' => $periodLabel,
            'active_filters' => $activeFilters,
        ];
    }

    public function formatIndonesianDate(Carbon $date): string
    {
        $monthName = self::MONTH_NAMES_ID[(int) $date->format('n')] ?? $date->format('M');

        return sprintf('%s %s %s', $date->format('d'), $monthName, $date->format('Y'));
    }

    public function formatIndonesianDateTime(?Carbon $date): string
    {
        if ($date === null) {
            return '-';
        }

        $jakarta = $date->copy()->setTimezone((string) config('app.timezone', 'Asia/Jakarta'));

        return sprintf('%s, %s WIB', $this->formatIndonesianDate($jakarta), $jakarta->format('H:i'));
    }

    private function parseDate(mixed $raw, string $timezone): ?Carbon
    {
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        try {
            return Carbon::parse(trim($raw), $timezone);
        } catch (\Throwable) {
            return null;
        }
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
