<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateAdminUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'role' => ['required', 'string', 'in:warga,bpbd_operator,bpbd_provinsi,peneliti,admin'],
            'institution' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', 'string', 'in:menunggu,aktif,nonaktif,ditolak'],
            'region_id' => ['nullable', 'uuid', 'exists:regions,id', 'required_if:role,bpbd_operator'],
        ];
    }
}
