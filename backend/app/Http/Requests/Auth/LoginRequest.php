<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class LoginRequest extends FormRequest
{
    public const MAX_ATTEMPTS = 5;
    public const DECAY_SECONDS = 60;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normalisasi input agar mendukung field `login`, `username`, maupun `email` (FR-001).
     */
    protected function prepareForValidation(): void
    {
        $identifier = $this->input('login')
            ?? $this->input('username')
            ?? $this->input('email');

        if (is_string($identifier)) {
            $this->merge([
                'login' => trim($identifier),
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Pesan validasi dalam Bahasa Indonesia (PRD Bagian 14).
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'login.required' => 'Username atau email wajib diisi.',
            'login.string' => 'Username atau email harus berupa teks.',
            'password.required' => 'Password wajib diisi.',
            'password.string' => 'Password harus berupa teks.',
        ];
    }

    /**
     * Kunci unik pembatasan percobaan login (rate limiting) berdasarkan identitas + IP.
     */
    public function throttleKey(): string
    {
        return 'login:' . Str::transliterate(Str::lower((string) $this->input('login')) . '|' . $this->ip());
    }
}
