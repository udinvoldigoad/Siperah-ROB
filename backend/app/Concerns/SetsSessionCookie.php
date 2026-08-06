<?php

namespace App\Concerns;

use App\Http\Middleware\CookieTokenAuth;
use Illuminate\Support\Facades\Cookie;
use Symfony\Component\HttpFoundation\Cookie as SymfonyCookie;

/**
 * Penerbit cookie sesi token Sanctum untuk SPA.
 *
 * Cookie httpOnly: JavaScript tidak pernah melihat nilainya, jadi token tak
 * bisa dicuri lewat XSS dari localStorage. Masa hidup cookie sengaja dibuat
 * jauh lebih panjang dari token — yang menjadi pintu sesungguhnya adalah
 * `expires_at` token yang diperpanjang tiap request aktif (EnsureActiveUser).
 */
trait SetsSessionCookie
{
    protected function sessionCookie(string $token): SymfonyCookie
    {
        return Cookie::make(
            CookieTokenAuth::SESSION_COOKIE,
            $token,
            60 * 24 * 30,          // 30 hari; token sesungguhnya kedaluwarsa lebih cepat
            '/',
            null,
            app()->isProduction(), // Secure hanya di HTTPS produksi (dev/E2E tetap berjalan)
            true,                  // HttpOnly
            true,                  // raw: nilai dikirim apa adanya (api group tanpa EncryptCookies)
            'Lax',                 // SameSite — memblokir cookie lintas-situs untuk non-GET
        );
    }
}
