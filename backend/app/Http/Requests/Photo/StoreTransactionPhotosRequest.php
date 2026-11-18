<?php

namespace App\Http\Requests\Photo;

use App\Services\TransactionPhotoService;
use Illuminate\Foundation\Http\FormRequest;

class StoreTransactionPhotosRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && (bool) $user->is_active
            && ($user->isAdmin() || $user->isPetugas());
    }

    public function rules(): array
    {
        return TransactionPhotoService::validationRules('photos', true);
    }

    public function messages(): array
    {
        return TransactionPhotoService::validationMessages('photos');
    }
}
