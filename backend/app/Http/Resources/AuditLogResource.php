<?php

namespace App\Http\Resources;

use App\Models\AuditLog;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\AuditLog
 */
class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actionLabel = match ($this->action) {
            AuditLog::ACTION_UPDATE => 'Perubahan Transaksi',
            AuditLog::ACTION_DELETE => 'Penghapusan Transaksi',
            AuditLog::ACTION_RESTORE => 'Pemulihan Transaksi',
            default => $this->action,
        };

        $oldValues = is_array($this->old_values) ? $this->old_values : null;
        $newValues = is_array($this->new_values) ? $this->new_values : null;

        return [
            'id' => $this->id,
            'transaction_id' => $this->transaction_id,
            'user_id' => $this->user_id,
            'action' => $this->action,
            'action_label' => $actionLabel,
            'description' => $this->description,
            'ip_address' => $this->ip_address,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'changed_fields' => $this->computeChangedFields($oldValues, $newValues),
            'user' => $this->whenLoaded('user', function () {
                return $this->user ? [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'username' => $this->user->username,
                    'role' => $this->user->role,
                ] : null;
            }),
            'transaction' => $this->whenLoaded('transaction', function () {
                if (! $this->transaction) {
                    return null;
                }

                return [
                    'id' => $this->transaction->id,
                    'type' => $this->transaction->type,
                    'type_label' => $this->transaction->type === Transaction::TYPE_MASUK
                        ? 'Barang Masuk'
                        : 'Barang Keluar',
                    'item_name' => $this->transaction->item_name,
                    'quantity' => (float) $this->transaction->quantity,
                    'unit' => $this->transaction->unit,
                    'transaction_datetime' => $this->transaction->transaction_datetime?->toIso8601String(),
                    'is_deleted' => $this->transaction->deleted_at !== null,
                    'deleted_at' => $this->transaction->deleted_at?->toIso8601String(),
                ];
            }),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     * @return array<int, string>
     */
    private function computeChangedFields(?array $oldValues, ?array $newValues): array
    {
        if ($oldValues === null || $newValues === null) {
            return [];
        }

        $keys = array_values(array_unique(array_merge(
            array_keys($oldValues),
            array_keys($newValues),
        )));

        $changed = [];
        foreach ($keys as $key) {
            $old = $oldValues[$key] ?? null;
            $new = $newValues[$key] ?? null;

            if ($key === 'quantity') {
                if ((float) $old !== (float) $new) {
                    $changed[] = $key;
                }
                continue;
            }

            if ($old !== $new) {
                $changed[] = $key;
            }
        }

        return $changed;
    }
}
