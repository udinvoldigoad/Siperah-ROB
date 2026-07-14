<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PublicMapController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ResearchController;
use Illuminate\Support\Facades\Route;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

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
// Melebihi batas mengembalikan HTTP 429 dengan pesan yang jelas + header Retry-After.
RateLimiter::for('api-key', fn (Request $request) => Limit::perMinute(120)
    ->by((string) ($request->attributes->get('api_key_id') ?? $request->ip()))
    ->response(fn (Request $request, array $headers) => response()->json([
        'data' => null,
        'message' => 'Batas permintaan API tercapai (120/menit). Coba lagi sebentar.',
        'retry_after' => (int) ($headers['Retry-After'] ?? 60),
    ], 429, $headers)));

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:registration');

// ── Public (tanpa login) ─────────────────────────────────────────
Route::prefix('public')->middleware('throttle:120,1')->group(function () {
    Route::get('/map', [PublicMapController::class, 'map']);
    Route::get('/map/export', [PublicMapController::class, 'mapExport']);
    Route::get('/predictions', [PublicMapController::class, 'predictions']);
    Route::get('/province/forecast', [PublicMapController::class, 'provinceForecast']);
    Route::get('/regions/{region}', [PublicMapController::class, 'region']);
    Route::get('/resolve-region', [PublicMapController::class, 'resolveRegion']);
    Route::get('/mode-awam', [PublicMapController::class, 'modeAwam']);
    Route::get('/onboarding', [PublicMapController::class, 'onboarding']);
});

// ── Authenticated ────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Reports — semua user login bisa lihat & buat
    Route::get('/reports', [ReportController::class, 'index']);
    Route::get('/reports/{report}', [ReportController::class, 'show']);
    Route::post('/reports', [ReportController::class, 'store'])->middleware('throttle:10,1');

    // BPBD & Admin — validasi laporan + dashboard
    Route::middleware('role:bpbd_operator,bpbd_provinsi,admin')->group(function () {
        Route::post('/reports/{report}/validate', [ReportController::class, 'validateReport']);
        Route::post('/reports/{report}/reject', [ReportController::class, 'rejectReport']);
        Route::patch('/reports/{report}/status', [ReportController::class, 'updateStatus']);
    });

    Route::get('/dashboard/operator/summary', [DashboardController::class, 'operatorSummary'])
        ->middleware('role:bpbd_operator,admin');
    Route::get('/dashboard/operator/reports/export', [DashboardController::class, 'operatorReportsExport'])
        ->middleware('role:bpbd_operator,admin');
    Route::get('/dashboard/province/summary', [DashboardController::class, 'provinceSummary'])
        ->middleware('role:bpbd_provinsi,admin');
    Route::get('/dashboard/province/export', [DashboardController::class, 'provinceExport'])
        ->middleware('role:bpbd_provinsi,admin');

    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/users', [AdminController::class, 'users']);
        Route::post('/admin/users', [AdminController::class, 'storeUser']);
        Route::get('/admin/users/export', [AdminController::class, 'exportUsers']);
        Route::post('/admin/users/{user}/approve', [AdminController::class, 'approveUser']);
        Route::post('/admin/users/{user}/reject', [AdminController::class, 'rejectUser']);
        Route::patch('/admin/users/{user}', [AdminController::class, 'updateUser']);
        Route::get('/admin/audit-logs', [AuditController::class, 'index']);
    });

    Route::middleware('role:peneliti,admin')->group(function () {
        Route::get('/research/datasets', [ResearchController::class, 'datasets']);
        Route::get('/research/datasets/{dataset}/download', [ResearchController::class, 'downloadDataset']);
        Route::get('/research/stats', [ResearchController::class, 'stats']);
        Route::get('/research/usage', [ResearchController::class, 'usage']);
        Route::get('/research/api-reference', [ResearchController::class, 'apiReference']);
        Route::get('/research/api-keys', [ResearchController::class, 'apiKeys']);
        Route::post('/research/api-keys', [ResearchController::class, 'regenerateKey']);
    });

    Route::get('/notifications/settings', [NotificationController::class, 'show']);
    Route::put('/notifications/settings', [NotificationController::class, 'update']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
});

Route::prefix('v1')->group(function () {
    Route::get('/predictions/daily', [ResearchController::class, 'dailyPredictions'])
        ->middleware(['api.key:predictions:read', 'throttle:api-key']);
    Route::get('/reports', [ResearchController::class, 'validatedReports'])
        ->middleware(['api.key:reports:read', 'throttle:api-key']);
    Route::get('/tidal', [ResearchController::class, 'tidal'])
        ->middleware(['api.key:tidal:read', 'throttle:api-key']);
});
