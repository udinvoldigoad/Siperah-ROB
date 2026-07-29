<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'role' => $this->role,
            'institution' => $this->institution,
            'status' => $this->status,
            'region_id' => $this->region_id,
            'region_name' => $this->whenLoaded('region', fn () => trim(implode(', ', array_filter([
                $this->region?->village,
                $this->region?->district,
                $this->region?->regency,
            ])))),
            // Admin memutuskan menyetujui/menolak akun peneliti dari sini.
            // `reason` dulu dikarang dari nama instansi ("Permohonan akses data
            // untuk institusi X") — kalimat itu tidak menambah informasi apa pun
            // di atas kolom institution yang sudah tampil. Sekarang isinya
            // alasan asli yang ditulis pemohon saat mendaftar.
            'permission_workflow' => $this->role === 'peneliti' ? [
                'status' => $this->status,
                'institution' => $this->institution,
                'reason' => $this->research_purpose,
                // Admin tak boleh menyetujui akun yang kepemilikan emailnya
                // belum terbukti — permohonan bisa saja memakai alamat orang lain.
                'email_verified' => $this->email_verified_at !== null,
            ] : null,
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
        ];
    }
}
