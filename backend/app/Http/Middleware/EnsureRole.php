<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user || !in_array($user->role, $roles, true)) {
            app(AuditService::class)->write($request, 'access_denied', 'denied', $request->path(), [
                'required_roles' => $roles,
                'actual_role' => $user?->role,
            ]);
            abort(403);
        }

        return $next($request);
    }
}
