<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class NotificationSettingsRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        // 'present' (bukan 'required'): array kosong adalah nilai yang sah —
        // UI sendiri berbunyi "Kosongkan untuk seluruh Provinsi", dan user
        // berhak mematikan semua saluran/peristiwa.
        return [
            'channels' => ['present', 'array'],
            'channels.*' => ['string', 'in:browser,email'],
            'event_types' => ['present', 'array'],
            'event_types.*' => ['string', 'in:bahaya_sangat_tinggi,laporan_ground_truth,pembaruan_model,ringkasan_harian,peringatan_bmkg'],
            'monitored_regions' => ['present', 'array'],
            'monitored_regions.*' => ['string', 'max:100'],
        ];
    }
}
