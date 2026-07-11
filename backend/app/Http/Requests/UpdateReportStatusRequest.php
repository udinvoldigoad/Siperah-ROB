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
        return [
            'status' => ['required', 'string', 'in:menunggu,perlu_review,divalidasi,ditolak,duplikat'],
            'rejection_reason' => ['nullable', 'string', 'required_if:status,ditolak'],
        ];
    }
}
