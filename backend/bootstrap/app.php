<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\AuthenticateApiKey;
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
        $schedule->command('audit:prune')
            ->dailyAt('03:30')
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping();
        $schedule->command('backup:clean')
            ->dailyAt('01:00')
            ->timezone('Asia/Jakarta');
        $schedule->command('backup:run')
            ->dailyAt('01:30')
            ->timezone('Asia/Jakarta');
    })
    ->withMiddleware(function (Middleware $middleware): void {
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
