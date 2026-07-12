<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\AuthenticateApiKey;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
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
