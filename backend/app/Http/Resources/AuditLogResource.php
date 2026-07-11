<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'actor_name' => $this->actor_name,
            'actor_role' => $this->actor_role,
            'action' => $this->action,
            'target_resource' => $this->target_resource,
            'outcome' => $this->outcome,
            'ip_address' => $this->ip_address,
            'payload' => $this->payload,
            'created_at' => $this->created_at,
            
            'actor' => new UserResource($this->whenLoaded('actor')),
        ];
    }
}
