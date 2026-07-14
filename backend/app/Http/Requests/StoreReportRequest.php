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
            'region_id' => ['nullable', 'uuid', 'exists:regions,id'],
            'water_height_cm' => ['required', 'integer', 'min:0'],
            'severity' => ['nullable', 'string', 'in:ringan,sedang,parah,sangat_parah'],
            'incident_time' => ['required', 'date'],
            'description' => ['required', 'string', 'max:1000'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'photos.max' => 'Maksimal 5 foto untuk satu laporan.',
            'photos.*.image' => 'File dokumentasi harus berupa gambar JPG, PNG, atau WebP.',
            'photos.*.mimes' => 'Foto hanya boleh berformat JPG, PNG, atau WebP.',
            'photos.*.mimetypes' => 'Foto hanya boleh berformat JPG, PNG, atau WebP.',
            'photos.*.max' => 'Setiap foto maksimal berukuran 2 MB.',
        ];
    }
}
