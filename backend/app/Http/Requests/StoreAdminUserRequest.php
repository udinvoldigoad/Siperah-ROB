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
            'role' => ['required', 'string', 'in:warga,peneliti,admin'],
            'institution' => ['nullable', 'string', 'max:150', 'required_if:role,peneliti'],
            'status' => ['required', 'string', 'in:menunggu,aktif,nonaktif,ditolak'],
            'region_id' => ['nullable', 'uuid', 'exists:regions,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'institution.required_if' => 'Instansi wajib diisi untuk akun peneliti agar workflow perizinan jelas.',
            'institution.required_if' => 'Instansi wajib diisi untuk akun peneliti agar workflow perizinan jelas.',
        ];
    }
}
