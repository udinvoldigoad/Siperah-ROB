<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ApiKeyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key_prefix' => $this->key_prefix,
            'status' => $this->status,
            'scopes' => $this->scopes,
            'use_count' => $this->use_count,
            'last_used_at' => $this->last_used_at,
            'created_at' => $this->created_at,
            'revoked_at' => $this->revoked_at,
        ];
    }
}
