<?php

namespace App\Http\Resources;

use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Transaction
 */
class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $numericQuantity = (float) $this->quantity;
        $formattedQuantity = rtrim(rtrim(number_format($numericQuantity, 2, ',', '.'), '0'), ',');

        return [
            'id' => $this->id,
            'type' => $this->type,
            'type_label' => $this->type === Transaction::TYPE_MASUK
                ? 'Barang Masuk'
                : 'Barang Keluar',
            'transaction_datetime' => $this->transaction_datetime?->toIso8601String(),
            'item_name' => $this->item_name,
            'quantity' => $numericQuantity,
            'quantity_formatted' => $formattedQuantity,
            'unit' => $this->unit,
            'work_type_id' => $this->work_type_id,
            'work_type' => $this->whenLoaded('workType', function () {
                return $this->workType ? [
                    'id' => $this->workType->id,
                    'name' => $this->workType->name,
                ] : null;
            }),
            'work_description' => $this->work_description,
            'origin' => $this->origin,
            'destination' => $this->destination,
            'sender_name' => $this->sender_name,
            'recipient_name' => $this->recipient_name,
            'taker_name' => $this->taker_name,
            'giver_name' => $this->giver_name,
            'recorded_by' => $this->recorded_by,
            'recorder' => $this->whenLoaded('recorder', function () {
                return $this->recorder ? [
                    'id' => $this->recorder->id,
                    'name' => $this->recorder->name,
                    'username' => $this->recorder->username,
                    'role' => $this->recorder->role,
                ] : null;
            }),
            'created_by' => $this->created_by,
            'updated_by' => $this->updated_by,
            'photos' => TransactionPhotoResource::collection($this->whenLoaded('photos')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
