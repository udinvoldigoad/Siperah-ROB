<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
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
                'account_status' => $user?->status,
            ], 403);
        }

        // Sliding expiration: tiap request sah memperpanjang token. Token yang
        // dicuri ikut mati bila tidak terus dipakai; pengguna aktif tidak pernah
        // terputus selama masih beraktivitas. TransientToken (Sanctum::actingAs
        // di tes) bukan token persisten & tanpa expiry — dilewati.
        $token = $request->user()?->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $expiration = app()->bound('config') ? (int) config('sanctum.expiration', 0) : 0;
            if ($expiration > 0) {
                $token->forceFill(['expires_at' => now()->addMinutes($expiration)])->save();
            }
        }

        return $next($request);
    }
}
