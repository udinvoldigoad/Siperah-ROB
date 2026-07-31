<?php

namespace Tests\Feature;

use App\Models\Prediction;
use App\Models\Region;
use App\Models\User;
use App\Notifications\HighRiskWarningNotification;
use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

final class NotificationBehaviorTest extends TestCase
{
    use DatabaseTransactions;

    public function test_critical_high_risk_warning_is_not_delayed(): void
    {
        Notification::fake();

        $region = $this->makeRegion('Kabupaten Notif Kritis');
        $warga = $this->makeUser('warga');
        $this->makePrediction($region, 'sangat_tinggi');

        $sent = app(NotificationService::class)
            ->notifyHighRiskPredictions(CarbonImmutable::today()->toDateString());

        $this->assertGreaterThanOrEqual(1, $sent);
        Notification::assertSentTo(
            $warga,
            HighRiskWarningNotification::class,
            fn (HighRiskWarningNotification $notification) => $notification->delay === null,
        );
    }

    public function test_high_risk_warning_scopes_recipients_by_region(): void
    {
        Notification::fake();

        $regionA = $this->makeRegion('Kabupaten Skop A');
        $regionB = $this->makeRegion('Kabupaten Skop B');
        $this->makePrediction($regionA, 'sangat_tinggi');

        // Peran bpbd_operator (beserta penyaringan per region_id-nya di
        // NotificationService) sudah dihapus. Cakupan penerima kini ditentukan
        // monitored_regions untuk warga/peneliti, dan admin selalu menerima.
        $wargaSubscribed = $this->makeUser('warga');
        $this->setMonitoredRegions($wargaSubscribed, [$regionA->village]);
        $wargaElsewhere = $this->makeUser('warga');
        $this->setMonitoredRegions($wargaElsewhere, ['Kelurahan Antah Berantah']);
        $admin = $this->makeUser('admin');

        app(NotificationService::class)
            ->notifyHighRiskPredictions(CarbonImmutable::today()->toDateString());

        Notification::assertSentTo($wargaSubscribed, HighRiskWarningNotification::class);
        Notification::assertNotSentTo($wargaElsewhere, HighRiskWarningNotification::class);
        Notification::assertSentTo($admin, HighRiskWarningNotification::class);
    }

    public function test_high_risk_warning_is_not_sent_twice_for_same_date(): void
    {
        $region = $this->makeRegion('Kabupaten Notif Dedup');
        $warga = $this->makeUser('warga');
        $this->setMonitoredRegions($warga, [$region->village]);
        $this->makePrediction($region, 'sangat_tinggi');

        $service = app(NotificationService::class);
        $date = CarbonImmutable::today()->toDateString();
        $service->notifyHighRiskPredictions($date);
        $service->notifyHighRiskPredictions($date);

        $inboxCount = DB::table('notification_inbox')
            ->where('user_id', $warga->id)
            ->where('type', 'high_risk_warning')
            ->count();
        $this->assertSame(1, $inboxCount);
    }

    public function test_high_risk_notification_query_count_does_not_grow_with_user_count(): void
    {
        // Regresi AU-11: dulu tiap user memicu firstOrCreate settings (SELECT,
        // kadang INSERT) + exists() ke notification_inbox — 2 query per user.
        // Pra-muat kolektif membuat jumlah query konstan.
        $region = $this->makeRegion('Kabupaten Notif N1');
        $this->makePrediction($region, 'sangat_tinggi');

        for ($i = 0; $i < 8; $i++) {
            $user = $this->makeUser('warga');
            $this->setMonitoredRegions($user, [$region->village]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(NotificationService::class)->notifyHighRiskPredictions(CarbonImmutable::today()->toDateString());
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Pengiriman notifikasi itu sendiri wajar memakai query per penerima
        // (insert inbox + kanal). Yang diunci di sini: pembacaan PENGATURAN dan
        // penanda "sudah dikirim" harus KOLEKTIF — tepat satu query ber-`in (...)`
        // per tabel (pra-muat untuk semua user), bukan query terpisah per user
        // di dalam loop.
        $collectiveSelects = static fn (string $table) => array_filter(
            $queries,
            fn (array $q): bool => str_starts_with(trim(mb_strtolower($q['query'])), 'select')
                && str_contains(mb_strtolower($q['query']), $table)
                && str_contains(mb_strtolower($q['query']), ' in ('),
        );

        self::assertCount(
            1,
            $collectiveSelects('notification_settings'),
            'Settings harus dipra-muat sekali lewat whereIn, bukan per user.',
        );
        self::assertCount(
            1,
            $collectiveSelects('notification_inbox'),
            'Penanda sudah-dikirim harus dibaca sekali lewat whereIn, bukan per user.',
        );
    }

    private function setMonitoredRegions(User $user, array $regions): void
    {
        $settings = app(NotificationService::class)->settings($user->id);
        $settings->monitored_regions = $regions;
        $settings->save();
    }

    private function makePrediction(Region $region, string $riskClass): Prediction
    {
        return Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => CarbonImmutable::today()->toDateString(),
            'risk_probability' => 91.0,
            'risk_class' => $riskClass,
            'confidence_score' => 88.0,
            'max_tidal_height' => 1.6,
            'peak_time' => '17:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'notification-behavior-test',
            'provenance_status' => 'demo',
        ]);
    }

    private function makeUser(string $role, ?string $regionId = null): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Notif Test',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => $role,
            'status' => 'aktif',
            'region_id' => $regionId,
        ]);
    }

    private function makeRegion(string $regency): Region
    {
        $id = (string) Str::uuid();
        $village = 'Kelurahan '.Str::headline(Str::random(6));
        $geometry = 'MULTIPOLYGON(((105.25 -5.455,105.27 -5.455,105.27 -5.435,105.25 -5.435,105.25 -5.455)))';
        $postgisInstalled = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgisInstalled ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', ?, 'Kecamatan Notif', ?, {$geometrySql}, 1000, true, 'FeatureTest', 'notification-behavior-test', 'demo', now(), now())",
            [$id, $regency, $village, $geometry],
        );

        return Region::findOrFail($id);
    }
}
