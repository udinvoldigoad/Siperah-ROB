<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

final class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = $request->user();

        abort_unless($user && in_array($user->role, $roles, true), 403);

        return $next($request);
    }
}
