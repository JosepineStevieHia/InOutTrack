<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    protected function prepareForValidation(): void
    {
        $data = [];

        if ($this->has('name') && is_string($this->input('name'))) {
            $data['name'] = trim($this->input('name'));
        }

        if ($this->has('username') && is_string($this->input('username'))) {
            $data['username'] = strtolower(trim($this->input('username')));
        }

        if ($this->has('email')) {
            $email = $this->input('email');
            $data['email'] = is_string($email) && trim($email) === ''
                ? null
                : (is_string($email) ? strtolower(trim($email)) : $email);
        }

        if ($this->has('password') && $this->input('password') === '') {
            $data['password'] = null;
        }

        if ($this->has('is_active')) {
            $data['is_active'] = $this->boolean('is_active');
        }

        $this->merge($data);
    }

    public function rules(): array
    {
        /** @var User|int|string|null $targetUser */
        $targetUser = $this->route('user');
        $targetId = $targetUser instanceof User ? $targetUser->id : $targetUser;

        return [
            'name' => ['required', 'string', 'max:100'],
            'username' => [
                'required',
                'string',
                'min:3',
                'max:50',
                'regex:/^[a-zA-Z0-9._-]+$/',
                Rule::unique('users', 'username')->ignore($targetId),
            ],
            'email' => [
                'nullable',
                'string',
                'email',
                'max:150',
                Rule::unique('users', 'email')->ignore($targetId),
            ],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_PETUGAS])],
            'is_active' => ['required', 'boolean'],
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
            'password.min' => 'Password baru minimal 8 karakter.',
            'role.required' => 'Role pengguna wajib dipilih.',
            'role.in' => 'Role harus Admin (Staf Administrasi) atau Petugas Store/Security.',
            'is_active.required' => 'Status aktif akun wajib ditentukan.',
            'is_active.boolean' => 'Status aktif tidak valid.',
        ];
    }
}
