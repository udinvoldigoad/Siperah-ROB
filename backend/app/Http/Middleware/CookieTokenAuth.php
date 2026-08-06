<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Jembatan cookie → bearer token untuk SPA.
 *
 * Sebelumnya token Sanctum disimpan di localStorage dan dikirim lewat header
 * `Authorization`; token yang tersimpan di localStorage bisa dicuri oleh
 * skrip apa pun yang berhasil injeksi (XSS). Sekarang token disimpan server
 * di cookie httpOnly (`saibar_session`) dan middleware ini menerjemahkannya
 * menjadi header `Authorization` sebelum guard Sanctum berjalan — alur autentikasi
 * Sanctum di bawahnya tetap tidak berubah.
 *
 * CSRF: cookie memakai SameSite=Lax + HttpOnly, sehingga permintaan POST/PUT/
 * PATCH/DELETE lintas-situs tidak ikut mengirim cookie — vektor CSRF klasik
 * tertutup di lapisan cookie.
 */
final class CookieTokenAuth
{
    public const SESSION_COOKIE = 'saibar_session';

    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->headers->has('Authorization')) {
            $token = $request->cookie(self::SESSION_COOKIE);
            if (is_string($token) && $token !== '') {
                $request->headers->set('Authorization', 'Bearer '.$token);
            }
        }

        return $next($request);
    }
}
