<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Observability minimal: system:health-check mengagregasi 3 sinyal yang
 * sudah ada (data_import_runs gagal, failed_jobs, baris ERROR log Laravel)
 * jadi satu ringkasan + exit code, tanpa menambah kanal alert baru.
 */
final class SystemHealthCheckTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        // laravel.log adalah file bersama yang terus terisi selama sesi dev
        // (server lokal, run test lain) — bersihkan agar tiap test mulai
        // dari keadaan bersih, bukan cuma dibersihkan setelahnya.
        file_put_contents(storage_path('logs/laravel.log'), '');
    }

    public function test_reports_success_when_no_recent_failures(): void
    {
        $this->assertSame(0, Artisan::call('system:health-check', ['--hours' => 24]));
        $this->assertStringContainsString('Sistem sehat', Artisan::output());
    }

    public function test_detects_failed_data_import_run_within_window(): void
    {
        DB::table('data_import_runs')->insert([
            'id' => (string) Str::uuid(),
            'source' => 'Uji Health Check',
            'dataset_type' => 'tidal',
            'status' => 'failed',
            'error_summary' => json_encode(['Koneksi ke sumber data gagal.']),
            'started_at' => now()->subMinutes(30),
        ]);

        $this->assertSame(1, Artisan::call('system:health-check', ['--hours' => 24]));
        $this->assertStringContainsString('pipeline import gagal', Artisan::output());
    }

    public function test_ignores_failed_run_outside_lookback_window(): void
    {
        DB::table('data_import_runs')->insert([
            'id' => (string) Str::uuid(),
            'source' => 'Uji Health Check Lampau',
            'dataset_type' => 'tidal',
            'status' => 'failed',
            'started_at' => now()->subDays(3),
        ]);

        $this->assertSame(0, Artisan::call('system:health-check', ['--hours' => 24]));
    }

    public function test_detects_failed_job_within_window(): void
    {
        DB::table('failed_jobs')->insert([
            'uuid' => (string) Str::uuid(),
            'connection' => 'database',
            'queue' => 'default',
            'payload' => json_encode(['job' => 'UjiHealthCheckJob']),
            'exception' => 'Exception uji health check.',
            'failed_at' => now()->subMinutes(10),
        ]);

        $this->assertSame(1, Artisan::call('system:health-check', ['--hours' => 24]));
        $this->assertStringContainsString('job antrean gagal', Artisan::output());
    }

    public function test_detects_recent_error_log_line(): void
    {
        $logPath = storage_path('logs/laravel.log');
        $timestamp = now()->format('Y-m-d H:i:s');
        file_put_contents(
            $logPath,
            "[{$timestamp}] testing.ERROR: Uji baris error health check.\n",
            FILE_APPEND,
        );

        $this->assertSame(1, Artisan::call('system:health-check', ['--hours' => 1]));
        $this->assertStringContainsString('baris ERROR di log Laravel', Artisan::output());
    }

    public function test_ignores_old_error_log_line_outside_window(): void
    {
        $logPath = storage_path('logs/laravel.log');
        $timestamp = now()->subHours(5)->format('Y-m-d H:i:s');
        file_put_contents(
            $logPath,
            "[{$timestamp}] testing.ERROR: Uji baris error lampau.\n",
            FILE_APPEND,
        );

        $this->assertSame(0, Artisan::call('system:health-check', ['--hours' => 1]));
    }
}
