<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use App\Models\AuditLog;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Str;

final class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next, ?string $requiredScope = null): Response
    {
        $rawKey = $this->rawKey($request);
        if (!$rawKey || !str_starts_with($rawKey, 'spr_')) {
            return $this->unauthorized('API key wajib dikirim melalui header X-API-Key.');
        }

        $apiKey = ApiKey::with('user')
            ->where('key_hash', hash('sha256', $rawKey))
            ->where('status', 'aktif')
            ->whereNull('revoked_at')
            ->first();

        if (!$apiKey || !$apiKey->user || $apiKey->user->status !== 'aktif') {
            return $this->unauthorized('API key tidak valid, dicabut, atau pemiliknya tidak aktif.');
        }

        if (!in_array($apiKey->user->role, ['peneliti', 'admin'], true)) {
            return new JsonResponse(['data' => null, 'message' => 'Pemilik API key tidak memiliki akses peneliti.'], 403);
        }

        if ($requiredScope && !in_array($requiredScope, $apiKey->scopes ?? [], true)) {
            return new JsonResponse(['data' => null, 'message' => "API key tidak memiliki scope {$requiredScope}."], 403);
        }

        $apiKey->forceFill([
            'last_used_at' => now(),
            'use_count' => $apiKey->use_count + 1,
        ])->save();

        $request->setUserResolver(fn () => $apiKey->user);
        $request->attributes->set('api_key_id', $apiKey->id);

        $response = $next($request);

        AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $apiKey->user->id,
            'actor_name' => $apiKey->user->name,
            'actor_role' => $apiKey->user->role,
            'action' => 'api_key_request',
            'target_resource' => $request->path(),
            'outcome' => $response->getStatusCode() < 400 ? 'success' : 'fail',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['api_key_id' => $apiKey->id, 'method' => $request->method(), 'status' => $response->getStatusCode()],
        ]);

        return $response;
    }

    private function rawKey(Request $request): ?string
    {
        $header = trim((string) $request->header('X-API-Key'));
        if ($header !== '') {
            return $header;
        }

        $authorization = trim((string) $request->header('Authorization'));
        return str_starts_with($authorization, 'ApiKey ') ? trim(substr($authorization, 7)) : null;
    }

    private function unauthorized(string $message): JsonResponse
    {
        return new JsonResponse(['data' => null, 'message' => $message], 401);
    }
}
