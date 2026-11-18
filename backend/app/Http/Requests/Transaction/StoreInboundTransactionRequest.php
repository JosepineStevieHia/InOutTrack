<?php

namespace App\Http\Requests\Transaction;

class StoreInboundTransactionRequest extends BaseStoreTransactionRequest
{
    public function rules(): array
    {
        return array_merge($this->commonRules(), [
            'origin' => ['required', 'string', 'max:255'],
            'sender_name' => ['required', 'string', 'max:150'],
        ]);
    }

    public function messages(): array
    {
        return array_merge($this->commonMessages(), [
            'origin.required' => 'Asal barang wajib diisi.',
            'origin.max' => 'Asal barang maksimal 255 karakter.',
            'sender_name.required' => 'Nama pengantar wajib diisi.',
            'sender_name.max' => 'Nama pengantar maksimal 150 karakter.',
        ]);
    }
}
