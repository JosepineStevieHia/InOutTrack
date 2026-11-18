<?php

namespace App\Http\Requests\Transaction;

class StoreOutboundTransactionRequest extends BaseStoreTransactionRequest
{
    public function rules(): array
    {
        return array_merge($this->commonRules(), [
            'destination' => ['required', 'string', 'max:255'],
            'taker_name' => ['required', 'string', 'max:150'],
        ]);
    }

    public function messages(): array
    {
        return array_merge($this->commonMessages(), [
            'destination.required' => 'Tujuan barang wajib diisi.',
            'destination.max' => 'Tujuan barang maksimal 255 karakter.',
            'taker_name.required' => 'Nama pengambil wajib diisi.',
            'taker_name.max' => 'Nama pengambil maksimal 150 karakter.',
        ]);
    }
}
