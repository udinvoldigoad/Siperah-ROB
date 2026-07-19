<?php

namespace Tests\Feature;

use App\Models\GroundTruthReport;
use App\Models\Region;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Jalur produksi antrean database (Tahap 7): notifikasi ShouldQueue masuk
 * tabel `jobs` saat QUEUE_CONNECTION=database, lalu `queue:work
 * --stop-when-empty` (perintah yang sama dengan cron Hostinger) memprosesnya
 * sampai mendarat di notification_inbox tanpa ada failed job.
 */
final class QueueWorkerTest extends TestCase
{
    use DatabaseTransactions;

    public function test_queued_notification_is_processed_by_stop_when_empty_worker(): void
    {
        config(['queue.default' => 'database']);
        $jobsBefore = DB::table('jobs')->count();

        $region = $this->insertRegion();
        $operator = $this->makeUser('bpbd_operator', $region->id);
        // Jam tenang dinolkan agar job tidak tertunda (available_at masa depan
        // tidak akan diambil worker stop-when-empty).
        $settings = app(NotificationService::class)->settings($operator->id);
        $settings->quiet_start = null;
        $settings->quiet_end = null;
        $settings->save();
        $report = $this->makeReport($this->makeUser('warga'), $region);

        app(NotificationService::class)->notifyNewReportForReview($report);

        $this->assertGreaterThan(
            $jobsBefore,
            DB::table('jobs')->count(),
            'Notifikasi ShouldQueue harus tertulis ke tabel jobs, bukan dieksekusi inline.',
        );

        $this->assertSame(0, Artisan::call('queue:work', [
            '--stop-when-empty' => true,
            '--sleep' => 0,
            '--tries' => 3,
        ]));

        $this->assertSame($jobsBefore, DB::table('jobs')->count(), 'Antrean harus kosong kembali setelah worker jalan.');
        $this->assertSame(0, DB::table('failed_jobs')->count(), 'Tidak boleh ada failed job.');
        $this->assertTrue(
            DB::table('notification_inbox')
                ->where('user_id', $operator->id)
                ->where('type', 'report_review')
                ->exists(),
            'Notifikasi hasil proses worker harus mendarat di inbox operator.',
        );
    }

    private function makeUser(string $role, ?string $regionId = null): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Queue Test',
            'email' => Str::uuid().'@example.test',
            'role' => $role,
            'status' => 'aktif',
            'region_id' => $regionId,
        ]);
    }

    private function makeReport(User $reporter, Region $region): GroundTruthReport
    {
        return GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => 'QUEUE-'.Str::upper(Str::random(8)),
            'user_id' => $reporter->id,
            'region_id' => $region->id,
            'latitude' => -5.445,
            'longitude' => 105.260,
            'severity' => 'sedang',
            'water_height_cm' => 25,
            'incident_time' => now(),
            'description' => 'Laporan uji antrean database.',
            'status' => 'menunggu',
        ]);
    }

    private function insertRegion(): Region
    {
        $id = (string) Str::uuid();
        $geometry = 'MULTIPOLYGON(((105.25 -5.455,105.27 -5.455,105.27 -5.435,105.25 -5.435,105.25 -5.455)))';
        $postgisInstalled = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgisInstalled ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', 'Kabupaten Queue Test', 'Kecamatan Queue', 'Kelurahan Queue', {$geometrySql}, 1000, true, 'FeatureTest', 'queue-worker-test', 'demo', now(), now())",
            [$id, $geometry],
        );

        return Region::findOrFail($id);
    }
}
