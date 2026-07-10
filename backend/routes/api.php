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

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);

// ponytail: open for local prototype; move behind auth/role middleware when login is wired to the frontend.
Route::get('/reports', [ReportController::class, 'index']);
Route::get('/reports/{report}', [ReportController::class, 'show']);
Route::patch('/reports/{report}/status', [ReportController::class, 'updateStatus']);

Route::prefix('public')->group(function () {
    Route::get('/predictions', [PublicMapController::class, 'predictions']);
    Route::get('/regions/{region}', [PublicMapController::class, 'region']);
    Route::get('/mode-awam', [PublicMapController::class, 'modeAwam']);
    Route::get('/onboarding', [PublicMapController::class, 'onboarding']);
    Route::post('/reports', [ReportController::class, 'store']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::middleware('role:bpbd_operator,bpbd_provinsi,admin')->group(function () {
        Route::post('/reports/{report}/validate', [ReportController::class, 'validateReport']);
        Route::post('/reports/{report}/reject', [ReportController::class, 'rejectReport']);
        Route::get('/dashboard/operator/summary', [DashboardController::class, 'operatorSummary']);
        Route::get('/dashboard/province/summary', [DashboardController::class, 'provinceSummary']);
    });

    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/users', [AdminController::class, 'users']);
        Route::post('/admin/users/{user}/approve', [AdminController::class, 'approveUser']);
        Route::post('/admin/users/{user}/reject', [AdminController::class, 'rejectUser']);
        Route::patch('/admin/users/{user}', [AdminController::class, 'updateUser']);
        Route::get('/admin/audit-logs', [AuditController::class, 'index']);
    });

    Route::middleware('role:peneliti,admin')->group(function () {
        Route::get('/research/datasets', [ResearchController::class, 'datasets']);
        Route::get('/research/api-keys', [ResearchController::class, 'apiKeys']);
        Route::post('/research/api-keys', [ResearchController::class, 'regenerateKey']);
        Route::get('/v1/predictions/daily', [ResearchController::class, 'dailyPredictions']);
        Route::get('/v1/reports', [ResearchController::class, 'validatedReports']);
        Route::get('/v1/tidal', [ResearchController::class, 'tidal']);
    });

    Route::get('/notifications/settings', [NotificationController::class, 'show']);
    Route::put('/notifications/settings', [NotificationController::class, 'update']);
});
