<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use App\Services\AuditService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next, ?string $requiredScope = null): Response
    {
        $rawKey = $this->rawKey($request);
        if (!$rawKey || !str_starts_with($rawKey, 'spr_')) {
            $this->audit($request, 'api_key_request', 'denied', $request->path(), ['reason' => 'missing_or_malformed_key']);
            return $this->unauthorized('API key wajib dikirim melalui header X-API-Key.');
        }

        $apiKey = ApiKey::with('user')
            ->where('key_hash', hash('sha256', $rawKey))
            ->where('status', 'aktif')
            ->whereNull('revoked_at')
            ->first();

        if (!$apiKey || !$apiKey->user || $apiKey->user->status !== 'aktif') {
            $this->audit($request, 'api_key_request', 'denied', $request->path(), ['reason' => 'invalid_or_inactive_key']);
            return $this->unauthorized('API key tidak valid, dicabut, atau pemiliknya tidak aktif.');
        }

        $request->setUserResolver(fn () => $apiKey->user);
        if (!in_array($apiKey->user->role, ['peneliti', 'admin'], true)) {
            $this->audit($request, 'api_key_request', 'denied', $request->path(), ['api_key_id' => $apiKey->id, 'reason' => 'owner_role_not_allowed']);
            return new JsonResponse(['data' => null, 'message' => 'Pemilik API key tidak memiliki akses peneliti.'], 403);
        }

        if ($requiredScope && !in_array($requiredScope, $apiKey->scopes ?? [], true)) {
            $this->audit($request, 'api_key_request', 'denied', $request->path(), ['api_key_id' => $apiKey->id, 'required_scope' => $requiredScope, 'reason' => 'missing_scope']);
            return new JsonResponse(['data' => null, 'message' => "API key tidak memiliki scope {$requiredScope}."], 403);
        }

        // Increment ATOMIK di database agar tidak terjadi lost update saat
        // beberapa request paralel memakai API key yang sama. Pola lama
        // (read `use_count` lalu tulis +1) bisa menghitung kurang.
        ApiKey::whereKey($apiKey->id)->update([
            'last_used_at' => now(),
            'use_count' => DB::raw('use_count + 1'),
        ]);

        $request->attributes->set('api_key_id', $apiKey->id);

        $auditContext = [
            'api_key_id' => $apiKey->id,
            'user_id' => $apiKey->user_id,
            'method' => $request->method(),
            'endpoint' => '/'.ltrim($request->path(), '/'),
        ];

        // Outcome WAJIB tercatat meski handler downstream melempar exception
        // (mis. 500). Tanpa try/catch, audit sukses/gagal di bawah terlewat
        // sehingga statistik penggunaan API kehilangan panggilan yang error.
        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            $this->audit($request, 'api_key_request', 'fail', $request->path(), $auditContext + [
                'status' => 500,
                'exception' => class_basename($e),
            ]);
            throw $e;
        }

        $this->audit($request, 'api_key_request', $response->getStatusCode() < 400 ? 'success' : 'fail', $request->path(), $auditContext + [
            'status' => $response->getStatusCode(),
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

    private function audit(Request $request, string $action, string $outcome, string $target, array $payload = []): void
    {
        app(AuditService::class)->write($request, $action, $outcome, $target, $payload);
    }
}
