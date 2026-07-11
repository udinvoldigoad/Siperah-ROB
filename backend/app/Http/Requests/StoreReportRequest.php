<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'water_height_cm' => ['required', 'integer', 'min:0'],
            'severity' => ['required', 'string', 'in:ringan,sedang,parah,sangat_parah'],
            'incident_time' => ['required', 'date'],
            'description' => ['required', 'string', 'max:1000'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['image', 'max:5120'], // Max 5MB
        ];
    }
}
