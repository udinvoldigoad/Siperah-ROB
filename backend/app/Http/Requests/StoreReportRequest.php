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
            'water_height_cm' => ['required', 'integer', 'min:0', 'max:1000'],
            'severity' => ['nullable', 'string', 'in:ringan,sedang,parah,sangat_parah'],
            // Toleransi +10 menit untuk selisih jam perangkat; kejadian yang
            // benar-benar di masa depan bukan laporan genangan yang sah.
            'incident_time' => ['required', 'date', 'before_or_equal:'.now()->addMinutes(10)->toIso8601String()],
            'description' => ['required', 'string', 'max:1000'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'incident_time.before_or_equal' => 'Waktu kejadian tidak boleh di masa depan.',
            'photos.max' => 'Maksimal 5 foto untuk satu laporan.',
            'photos.*.image' => 'File dokumentasi harus berupa gambar JPG, PNG, atau WebP.',
            'photos.*.mimes' => 'Foto hanya boleh berformat JPG, PNG, atau WebP.',
            'photos.*.mimetypes' => 'Foto hanya boleh berformat JPG, PNG, atau WebP.',
            'photos.*.max' => 'Setiap foto maksimal berukuran 2 MB.',
        ];
    }
}
