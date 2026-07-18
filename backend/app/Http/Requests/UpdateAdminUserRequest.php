<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class UpdateAdminUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            // 'sometimes' agar pembaruan sebagian (mis. hanya status dari tombol
            // Aktifkan/Nonaktifkan) tidak wajib mengirim ulang role/region.
            'role' => ['sometimes', 'required', 'string', 'in:warga,bpbd_operator,bpbd_provinsi,peneliti,admin'],
            'institution' => ['nullable', 'string', 'max:150'],
            'status' => ['sometimes', 'required', 'string', 'in:menunggu,aktif,nonaktif,ditolak'],
            'region_id' => ['nullable', 'uuid', 'exists:regions,id'],
        ];
    }

    /**
     * Invariant audit wilayah kerja operator: setiap operator BPBD WAJIB punya
     * region_id valid. `required_if:role,bpbd_operator` saja tidak cukup karena
     * pada partial-update `role` bisa absen — mis. mengirim `region_id: null`
     * tanpa `role` akan mengosongkan wilayah kerja operator yang sudah ada dan
     * membuatnya kena 403 di semua endpoint. Karena itu kita hitung role & region
     * EFEKTIF (gabungan payload + kondisi user saat ini) dan validasi hasil akhir.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $current = User::find($this->route('user'));
            $effectiveRole = $this->input('role', $current?->role);

            if ($effectiveRole !== 'bpbd_operator') {
                return;
            }

            $effectiveRegionId = $this->has('region_id')
                ? $this->input('region_id')
                : $current?->region_id;

            if (empty($effectiveRegionId)) {
                $validator->errors()->add('region_id', 'Wilayah kerja wajib dipilih untuk akun operator BPBD.');
            }
        });
    }
}
