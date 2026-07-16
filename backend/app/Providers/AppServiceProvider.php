<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Rate limiter WAJIB didefinisikan di provider, bukan di routes/api.php:
        // saat route:cache aktif (production), file route tidak dieksekusi lagi
        // sehingga limiter yang didefinisikan di sana tidak pernah terdaftar.
        RateLimiter::for('login', function (Request $request) {
            $email = Str::lower(trim((string) $request->input('email')));

            return Limit::perMinute(10)
                ->by($email.'|'.$request->ip())
                ->response(fn (Request $request, array $headers) => response()->json([
                    'message' => 'Terlalu banyak percobaan login untuk akun ini. Coba lagi sebentar.',
                    'retry_after' => (int) ($headers['Retry-After'] ?? 60),
                ], 429, $headers));
        });

        RateLimiter::for('registration', fn (Request $request) => Limit::perHour(5)->by($request->ip()));

        // API key: 120 req/menit per kunci (fallback ke IP bila belum terautentikasi).
        RateLimiter::for('api-key', fn (Request $request) => Limit::perMinute(120)
            ->by((string) ($request->attributes->get('api_key_id') ?? $request->ip()))
            ->response(fn (Request $request, array $headers) => response()->json([
                'data' => null,
                'message' => 'Batas permintaan API tercapai (120/menit). Coba lagi sebentar.',
                'retry_after' => (int) ($headers['Retry-After'] ?? 60),
            ], 429, $headers)));
    }
}
