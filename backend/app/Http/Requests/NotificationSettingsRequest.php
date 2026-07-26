<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class NotificationSettingsRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'channels' => ['required', 'array'],
            'channels.*' => ['string', 'in:browser,email'],
            'event_types' => ['required', 'array'],
            'event_types.*' => ['string', 'in:bahaya_sangat_tinggi,laporan_ground_truth,pembaruan_model,ringkasan_harian,peringatan_bmkg'],
            'monitored_regions' => ['required', 'array'],
            'monitored_regions.*' => ['string', 'max:100'],
        ];
    }
}
