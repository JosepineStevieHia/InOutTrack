<?php

namespace App\Http\Requests\Admin;

use App\Models\WorkType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWorkTypeRequest extends FormRequest
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

        if ($this->has('description')) {
            $description = $this->input('description');
            $data['description'] = is_string($description) && trim($description) === ''
                ? null
                : (is_string($description) ? trim($description) : $description);
        }

        if ($this->has('is_active')) {
            $data['is_active'] = $this->boolean('is_active');
        }

        $this->merge($data);
    }

    public function rules(): array
    {
        /** @var WorkType|int|string|null $targetWorkType */
        $targetWorkType = $this->route('workType');
        $targetId = $targetWorkType instanceof WorkType ? $targetWorkType->id : $targetWorkType;

        return [
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('work_types', 'name')->ignore($targetId),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama jenis pekerjaan wajib diisi.',
            'name.max' => 'Nama jenis pekerjaan maksimal 100 karakter.',
            'name.unique' => 'Nama jenis pekerjaan sudah terdaftar.',
            'description.max' => 'Deskripsi maksimal 255 karakter.',
            'is_active.required' => 'Status aktif jenis pekerjaan wajib ditentukan.',
            'is_active.boolean' => 'Status aktif tidak valid.',
        ];
    }
}
