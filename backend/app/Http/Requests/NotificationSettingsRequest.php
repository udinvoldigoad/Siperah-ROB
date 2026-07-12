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
            'channels.*' => ['string', 'in:browser,email,whatsapp,sms'],
            'event_types' => ['required', 'array'],
            'event_types.*' => ['string', 'in:bahaya_sangat_tinggi,laporan_ground_truth,pembaruan_model,ringkasan_harian,peringatan_bmkg'],
            'quiet_start' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'quiet_end' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'monitored_regions' => ['required', 'array'],
            'monitored_regions.*' => ['string', 'max:100'],
        ];
    }
}
