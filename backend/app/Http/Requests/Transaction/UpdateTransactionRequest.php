<?php

namespace App\Http\Requests\Transaction;

use App\Models\Transaction;
use App\Models\TransactionPhoto;
use App\Models\WorkType;
use App\Services\TransactionPhotoService;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && (bool) $user->is_active
            && $user->isAdmin();
    }

    protected function prepareForValidation(): void
    {
        $trim = static fn (mixed $value): mixed => is_string($value) ? trim($value) : $value;

        $workDescription = $this->input('work_description');
        $cleanDescription = is_string($workDescription) && trim($workDescription) === ''
            ? null
            : $trim($workDescription);

        $this->merge([
            'item_name' => $trim($this->input('item_name')),
            'unit' => $trim($this->input('unit')),
            'work_description' => $cleanDescription,
            'origin' => $trim($this->input('origin')),
            'destination' => $trim($this->input('destination')),
            'sender_name' => $trim($this->input('sender_name')),
            'taker_name' => $trim($this->input('taker_name')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Transaction|null $transaction */
        $transaction = $this->route('transaction');
        $isInbound = $transaction?->isMasuk() ?? true;

        $rules = [
            'transaction_datetime' => [
                'required',
                'date',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! is_string($value) && ! $value instanceof \DateTimeInterface) {
                        $fail('Format tanggal dan waktu transaksi tidak valid.');
                        return;
                    }

                    $timezone = (string) config('app.timezone', 'Asia/Jakarta');

                    try {
                        $parsed = Carbon::parse($value, $timezone)->setTimezone($timezone);
                    } catch (\Throwable) {
                        $fail('Format tanggal dan waktu transaksi tidak valid.');
                        return;
                    }

                    if ($parsed->gt(now($timezone))) {
                        $fail('Tanggal dan waktu transaksi tidak boleh berada di masa depan.');
                    }
                },
            ],
            'item_name' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'unit' => ['required', 'string', 'max:50'],
            'work_type_id' => [
                'required',
                'integer',
                function (string $attribute, mixed $value, \Closure $fail) use ($transaction): void {
                    $workType = WorkType::query()->find((int) $value);
                    if (! $workType) {
                        $fail('Jenis pekerjaan yang dipilih tidak ditemukan.');
                        return;
                    }

                    if (! $workType->is_active && $transaction?->work_type_id !== $workType->id) {
                        $fail('Jenis pekerjaan yang dipilih berstatus nonaktif.');
                    }
                },
            ],
            'work_description' => ['nullable', 'string', 'max:500'],
        ];

        if ($isInbound) {
            $rules['origin'] = ['required', 'string', 'max:255'];
            $rules['sender_name'] = ['required', 'string', 'max:150'];
        } else {
            $rules['destination'] = ['required', 'string', 'max:255'];
            $rules['taker_name'] = ['required', 'string', 'max:150'];
        }

        $rules['delete_photo_ids'] = ['nullable', 'array'];
        $rules['delete_photo_ids.*'] = ['integer'];
        $rules = array_merge(
            $rules,
            TransactionPhotoService::validationRules('new_photos', false),
            TransactionPhotoService::validationRules('photos', false),
        );

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Transaction|null $transaction */
            $transaction = $this->route('transaction');
            if (! $transaction) {
                return;
            }

            $rawDeleteIds = $this->input('delete_photo_ids', []);
            $deleteIds = is_array($rawDeleteIds)
                ? array_values(array_unique(array_map('intval', $rawDeleteIds)))
                : [];

            $existingPhotoIds = $transaction->photos()->pluck('id')->all();

            if ($deleteIds !== []) {
                $invalidIds = array_diff($deleteIds, $existingPhotoIds);
                if ($invalidIds !== []) {
                    $validator->errors()->add(
                        'delete_photo_ids',
                        'Foto yang dipilih untuk dihapus tidak ditemukan pada transaksi ini.'
                    );
                    return;
                }
            }

            $newPhotos = $this->file('new_photos', []);
            $aliasPhotos = $this->file('photos', []);
            $incomingCount = (is_array($newPhotos) ? count($newPhotos) : 0)
                + (is_array($aliasPhotos) ? count($aliasPhotos) : 0);

            $existingCount = count($existingPhotoIds);
            $deleteCount = count($deleteIds);
            $finalCount = $existingCount - $deleteCount + $incomingCount;
            $maxPhotos = TransactionPhoto::MAX_PHOTOS_PER_TRANSACTION;

            if ($finalCount > $maxPhotos) {
                $validator->errors()->add(
                    'photos',
                    "Total foto per transaksi maksimal {$maxPhotos} foto."
                );
            }

            if ($finalCount < 1 && ($existingCount > 0 || $deleteCount > 0)) {
                $validator->errors()->add(
                    'photos',
                    'Transaksi wajib memiliki minimal satu foto barang.'
                );
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return array_merge(
            TransactionPhotoService::validationMessages('new_photos'),
            TransactionPhotoService::validationMessages('photos'),
            [
                'transaction_datetime.required' => 'Tanggal dan waktu transaksi wajib diisi.',
                'transaction_datetime.date' => 'Format tanggal dan waktu transaksi tidak valid.',
                'item_name.required' => 'Nama barang wajib diisi.',
                'item_name.max' => 'Nama barang maksimal 255 karakter.',
                'quantity.required' => 'Jumlah barang wajib diisi.',
                'quantity.numeric' => 'Jumlah barang harus berupa angka.',
                'quantity.gt' => 'Jumlah barang harus lebih dari 0.',
                'quantity.max' => 'Jumlah barang melebihi batas maksimum.',
                'quantity.regex' => 'Jumlah barang maksimal memiliki 2 angka di belakang koma.',
                'unit.required' => 'Satuan barang wajib diisi.',
                'unit.max' => 'Satuan barang maksimal 50 karakter.',
                'work_type_id.required' => 'Jenis pekerjaan wajib dipilih.',
                'work_type_id.integer' => 'Pilihan jenis pekerjaan tidak valid.',
                'work_description.max' => 'Deskripsi pekerjaan maksimal 500 karakter.',
                'origin.required' => 'Asal barang wajib diisi.',
                'origin.max' => 'Asal barang maksimal 255 karakter.',
                'sender_name.required' => 'Nama pengantar wajib diisi.',
                'sender_name.max' => 'Nama pengantar maksimal 150 karakter.',
                'destination.required' => 'Tujuan barang wajib diisi.',
                'destination.max' => 'Tujuan barang maksimal 255 karakter.',
                'taker_name.required' => 'Nama pengambil wajib diisi.',
                'taker_name.max' => 'Nama pengambil maksimal 150 karakter.',
                'delete_photo_ids.array' => 'Format daftar foto yang dihapus tidak valid.',
                'delete_photo_ids.*.integer' => 'ID foto yang akan dihapus tidak valid.',
            ],
        );
    }
}
