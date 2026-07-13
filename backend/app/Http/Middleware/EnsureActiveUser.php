<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureActiveUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || $user->status !== 'aktif') {
            app(AuditService::class)->write($request, 'access_denied', 'denied', $request->path(), [
                'reason' => 'inactive_user',
                'user_status' => $user?->status,
            ]);
            return new JsonResponse([
                'message' => 'Akun tidak aktif atau belum disetujui.',
            ], 403);
        }

        return $next($request);
    }
}
