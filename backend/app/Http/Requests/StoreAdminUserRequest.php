<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreAdminUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'string', 'email', 'max:150', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
            'phone_number' => ['nullable', 'string', 'max:30'],
            'role' => ['required', 'string', 'in:warga,bpbd_operator,bpbd_provinsi,peneliti,admin'],
            'institution' => ['nullable', 'string', 'max:150', 'required_if:role,peneliti'],
            'status' => ['required', 'string', 'in:menunggu,aktif,nonaktif,ditolak'],
            'region_id' => ['nullable', 'uuid', 'exists:regions,id', 'required_if:role,bpbd_operator'],
        ];
    }

    public function messages(): array
    {
        return [
            'institution.required_if' => 'Instansi wajib diisi untuk akun peneliti agar workflow perizinan jelas.',
            'region_id.required_if' => 'Wilayah kerja wajib dipilih untuk akun operator BPBD.',
        ];
    }
}
