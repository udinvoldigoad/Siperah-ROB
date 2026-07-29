<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Perhatikan: `role` dan `status` TIDAK pernah divalidasi di sini, jadi
     * keduanya tak bisa dikirim pemohon. Yang boleh dipilih hanyalah
     * `account_type`, dan pemetaannya ke peran/status dilakukan di controller.
     * Peneliti karena itu tidak bisa melompati antrean admin dengan menyusupkan
     * `status=aktif` ke payload.
     */
    public function rules(): array
    {
        return [
            'account_type' => ['nullable', 'string', 'in:warga,peneliti'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'region_id' => ['nullable', 'uuid', 'exists:regions,id'],

            // Warga: opsional (dipakai sebagai catatan desa/wilayah).
            // Peneliti: WAJIB — inilah bahan yang dipakai admin untuk menilai
            // permohonan, dan akun peneliti tertahan sampai admin menyetujui.
            'institution' => ['nullable', 'string', 'max:150', 'required_if:account_type,peneliti'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'research_purpose' => [
                'nullable',
                'string',
                'max:1000',
                'required_if:account_type,peneliti',
                // Batas bawah menahan isian asal ketik ("test", "-"): admin
                // tetap bebas menolak, tapi tak perlu memproses baris kosong.
                'min:30',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'institution.required_if' => 'Nama instansi/universitas wajib diisi untuk akun peneliti.',
            'research_purpose.required_if' => 'Jelaskan tujuan penggunaan data untuk akun peneliti.',
            'research_purpose.min' => 'Tujuan penggunaan data terlalu singkat — jelaskan minimal satu kalimat utuh.',
        ];
    }
}
