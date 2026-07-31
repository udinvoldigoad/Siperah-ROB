<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateReportStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Hanya status keputusan yang sah dari antrean (menunggu/perlu_review).
        // Laporan tidak boleh dikembalikan ke status antrean lewat endpoint ini —
        // transisi ke belakang membuat laporan "selesai" bisa dibuka ulang tanpa
        // jejak. State awal hanya ditentukan saat laporan dibuat.
        return [
            'status' => ['required', 'string', 'in:divalidasi,ditolak,duplikat'],
            'rejection_reason' => ['nullable', 'string', 'required_if:status,ditolak'],
        ];
    }
}
