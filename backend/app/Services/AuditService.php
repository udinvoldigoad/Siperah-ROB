<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class AuditService
{
    public function write(Request $request, string $action, string $outcome, ?string $target = null, array $payload = []): void
    {
        try {
            /** @var User|null $actor */
            $actor = $request->user();

            AuditLog::create([
                'id' => (string) Str::uuid(),
                'actor_user_id' => $actor?->id,
                'actor_name' => $actor?->name ?? ($payload['actor_name'] ?? 'Guest'),
                'actor_role' => $actor?->role ?? ($payload['actor_role'] ?? 'guest'),
                'action' => $action,
                'target_resource' => $target,
                'outcome' => $outcome,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'payload' => $payload === [] ? null : $payload,
            ]);
        } catch (\Throwable) {
            // Audit should never break the primary user flow.
        }
    }
}
