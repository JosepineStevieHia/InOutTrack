<?php

namespace App\Http\Requests\Transaction;

use App\Services\TransactionPhotoService;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

abstract class BaseStoreTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && (bool) $user->is_active
            && ($user->isAdmin() || $user->isPetugas());
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
     * Aturan umum untuk transaksi Barang Masuk dan Barang Keluar (PRD Bagian 6).
     *
     * @return array<string, mixed>
     */
    protected function commonRules(): array
    {
        return array_merge([
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

                    $now = now($timezone);

                    if ($parsed->gt($now)) {
                        $fail('Tanggal dan waktu transaksi tidak boleh berada di masa depan.');
                        return;
                    }

                    if ($this->user()?->isPetugas() && $parsed->lt($now->copy()->subHours(24)->subMinutes(5))) {
                        $fail('Petugas hanya dapat mencatat waktu transaksi maksimal 24 jam ke belakang.');
                    }
                },
            ],
            'item_name' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'unit' => ['required', 'string', 'max:50'],
            'work_type_id' => [
                'required',
                'integer',
                Rule::exists('work_types', 'id')->where('is_active', true),
            ],
            'work_description' => ['nullable', 'string', 'max:500'],
        ], TransactionPhotoService::validationRules('photos', true));
    }

    /**
     * Pesan error validasi Bahasa Indonesia untuk aturan umum transaksi.
     *
     * @return array<string, string>
     */
    protected function commonMessages(): array
    {
        return array_merge([
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
            'work_type_id.exists' => 'Jenis pekerjaan yang dipilih tidak ditemukan atau berstatus nonaktif.',
            'work_description.max' => 'Deskripsi pekerjaan maksimal 500 karakter.',
        ], TransactionPhotoService::validationMessages('photos'));
    }
}
