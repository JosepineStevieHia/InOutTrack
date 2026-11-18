<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');
        $username = $this->input('username');
        $name = $this->input('name');

        $this->merge([
            'name' => is_string($name) ? trim($name) : $name,
            'username' => is_string($username) ? strtolower(trim($username)) : $username,
            'email' => is_string($email) && trim($email) === '' ? null : (is_string($email) ? strtolower(trim($email)) : $email),
            'is_active' => $this->has('is_active') ? $this->boolean('is_active') : true,
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'username' => [
                'required',
                'string',
                'min:3',
                'max:50',
                'regex:/^[a-zA-Z0-9._-]+$/',
                Rule::unique('users', 'username'),
            ],
            'email' => [
                'nullable',
                'string',
                'email',
                'max:150',
                Rule::unique('users', 'email'),
            ],
            'password' => ['required', 'string', 'min:8', 'max:255'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_PETUGAS])],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama lengkap wajib diisi.',
            'name.max' => 'Nama lengkap maksimal 100 karakter.',
            'username.required' => 'Username wajib diisi.',
            'username.min' => 'Username minimal 3 karakter.',
            'username.max' => 'Username maksimal 50 karakter.',
            'username.regex' => 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.',
            'username.unique' => 'Username sudah digunakan oleh akun lain.',
            'email.email' => 'Format alamat email tidak valid.',
            'email.max' => 'Alamat email maksimal 150 karakter.',
            'email.unique' => 'Alamat email sudah digunakan oleh akun lain.',
            'password.required' => 'Password awal wajib diisi.',
            'password.min' => 'Password minimal 8 karakter.',
            'role.required' => 'Role pengguna wajib dipilih.',
            'role.in' => 'Role harus Admin (Staf Administrasi) atau Petugas Store/Security.',
            'is_active.boolean' => 'Status aktif tidak valid.',
        ];
    }
}
