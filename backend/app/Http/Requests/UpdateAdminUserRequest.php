<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateAdminUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            // 'sometimes' agar pembaruan sebagian (mis. hanya status dari tombol
            // Aktifkan/Nonaktifkan) tidak wajib mengirim ulang role.
            'role' => ['sometimes', 'required', 'string', 'in:warga,peneliti,admin'],
            'institution' => ['nullable', 'string', 'max:150'],
            'status' => ['sometimes', 'required', 'string', 'in:menunggu,aktif,nonaktif,ditolak'],
            'region_id' => ['nullable', 'uuid', 'exists:regions,id'],
        ];
    }
}
