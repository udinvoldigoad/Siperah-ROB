<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RejectReportRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'max:1000']];
    }
}
