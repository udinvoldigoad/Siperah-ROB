<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
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
        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            return 'http://localhost:5173/#/reset-password?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });

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

        // Endpoint publik (read) — configurable via config('limits.*') agar tetap
        // benar saat config:cache (ubah: .env + `php artisan config:cache`). Default
        // longgar karena response ter-cache & banyak warga berbagi IP di balik NAT ISP.
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute((int) config('limits.public_per_minute'))
            ->by($request->ip())
            ->response(fn (Request $request, array $headers) => response()->json([
                'message' => 'Terlalu banyak permintaan. Coba lagi sebentar.',
                'retry_after' => (int) ($headers['Retry-After'] ?? 60),
            ], 429, $headers)));

        // Export peta (stream CSV, lebih berat) — batas lebih ketat & terpisah.
        RateLimiter::for('public-export', fn (Request $request) => Limit::perMinute((int) config('limits.public_export_per_minute'))
            ->by($request->ip())
            ->response(fn (Request $request, array $headers) => response()->json([
                'message' => 'Terlalu banyak permintaan export. Coba lagi sebentar.',
                'retry_after' => (int) ($headers['Retry-After'] ?? 60),
            ], 429, $headers)));

        // API key v1: configurable via config('limits.api_per_minute') per kunci
        // (fallback ke IP bila belum terautentikasi). Ubah: .env + config:cache.
        $apiRateLimit = (int) config('limits.api_per_minute');
        RateLimiter::for('api-key', fn (Request $request) => Limit::perMinute($apiRateLimit)
            ->by((string) ($request->attributes->get('api_key_id') ?? $request->ip()))
            ->response(fn (Request $request, array $headers) => response()->json([
                'data' => null,
                'message' => "Batas permintaan API tercapai ({$apiRateLimit}/menit). Coba lagi sebentar.",
                'retry_after' => (int) ($headers['Retry-After'] ?? 60),
            ], 429, $headers)));
    }
}
