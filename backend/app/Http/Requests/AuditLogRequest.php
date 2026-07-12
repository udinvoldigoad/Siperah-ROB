<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AuditLogRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'action' => ['nullable', 'string', 'max:100'],
            'outcome' => ['nullable', 'in:success,fail,denied,partial'],
            'search' => ['nullable', 'string', 'max:100'],
            'format' => ['nullable', 'in:json,csv'],
            'per_page' => ['nullable', 'integer', 'between:1,200'],
        ];
    }
}
