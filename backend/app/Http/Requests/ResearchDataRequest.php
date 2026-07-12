<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ResearchDataRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'format' => ['nullable', 'in:json,csv'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'station' => ['nullable', 'string', 'max:50'],
            'region' => ['nullable', 'uuid', 'exists:regions,id'],
            'per_page' => ['nullable', 'integer', 'between:1,200'],
        ];
    }
}
