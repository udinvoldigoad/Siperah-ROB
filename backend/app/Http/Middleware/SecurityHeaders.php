<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security headers untuk respons yang lewat Laravel (API & foto laporan).
 * Production Hostinger tidak punya reverse proxy (nginx/Caddy), jadi header
 * ditanam di aplikasi; file statis SPA dicakup public/.htaccess.
 */
final class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // API hanya menyajikan JSON/berkas, bukan dokumen HTML — kunci total.
        if (!$headers->has('Content-Security-Policy')) {
            $headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        }

        // Browser mengabaikan HSTS di koneksi non-TLS, jadi aman dipasang
        // hanya saat request memang lewat HTTPS.
        if ($request->secure()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
