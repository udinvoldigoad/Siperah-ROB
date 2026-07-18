<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\AuthenticateApiKey;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        health: '/up',
        api: __DIR__.'/../routes/api.php',
        then: function (): void {
            Route::get('/', fn () => response()->json([
                'name' => 'SIPERAH-RoB API',
                'status' => 'ok',
                'frontend' => 'http://127.0.0.1:5173',
                'sample_api' => '/api/public/mode-awam',
            ]));
        },
    )
    ->withCommands()
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('data:fetch-tidal-sealevel --days-back=3')
            ->dailyAt('04:50')
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping();
        // Peringatan cuaca BMKG diperbarui beberapa kali sehari; refresh tiap 3 jam.
        $schedule->command('data:fetch-bmkg-warnings')
            ->everyThreeHours()
            ->withoutOverlapping();
        $schedule->command('data:refresh-operational --province=Lampung')
            ->dailyAt('05:00')
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping();
        $schedule->command('ml:predict')
            ->dailyAt('06:00')
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping()
            ->when(fn (): bool => (bool) config('services.ml_api.schedule_enabled'));
        $schedule->command('reports:notify-overdue-sla')
            ->hourly()
            ->withoutOverlapping();
        // Setengah jam setelah prediksi harian masuk (ML 06:00 WIB).
        $schedule->command('predictions:notify-high-risk')
            ->dailyAt('06:30')
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping();
        // Hostinger tidak bisa menjalankan worker daemon; proses antrean lewat
        // scheduler tiap menit. Hanya relevan saat QUEUE_CONNECTION=database
        // (sync memproses inline dan tidak pernah mengisi tabel jobs).
        $schedule->command('queue:work --stop-when-empty --tries=3 --max-time=50')
            ->everyMinute()
            ->withoutOverlapping()
            ->when(fn (): bool => config('queue.default') === 'database');
        $schedule->command('audit:prune')
            ->dailyAt('03:30')
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping();
        $backupEnabled = fn (): bool => (bool) config('services.backup.schedule_enabled');
        $schedule->command('backup:clean')
            ->dailyAt('01:00')
            ->timezone('Asia/Jakarta')
            ->when($backupEnabled);
        $schedule->command('backup:run')
            ->dailyAt('01:30')
            ->timezone('Asia/Jakarta')
            ->when($backupEnabled);
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SecurityHeaders::class);
        $middleware->alias([
            'active' => EnsureActiveUser::class,
            'api.key' => AuthenticateApiKey::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })
    ->create();
