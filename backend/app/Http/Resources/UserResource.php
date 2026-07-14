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
            'permission_workflow' => $this->role === 'peneliti' ? [
                'status' => $this->status,
                'institution' => $this->institution,
                'reason' => $this->institution ? "Permohonan akses data untuk institusi {$this->institution}." : null,
            ] : null,
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
        ];
    }
}
