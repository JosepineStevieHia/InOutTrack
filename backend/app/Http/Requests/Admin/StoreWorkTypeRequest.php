<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    protected function prepareForValidation(): void
    {
        $name = $this->input('name');
        $description = $this->input('description');

        $this->merge([
            'name' => is_string($name) ? trim($name) : $name,
            'description' => is_string($description) && trim($description) === '' ? null : (is_string($description) ? trim($description) : $description),
            'is_active' => $this->has('is_active') ? $this->boolean('is_active') : true,
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('work_types', 'name'),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama jenis pekerjaan wajib diisi.',
            'name.max' => 'Nama jenis pekerjaan maksimal 100 karakter.',
            'name.unique' => 'Nama jenis pekerjaan sudah terdaftar.',
            'description.max' => 'Deskripsi maksimal 255 karakter.',
            'is_active.boolean' => 'Status aktif tidak valid.',
        ];
    }
}
