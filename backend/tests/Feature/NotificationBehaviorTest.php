<?php

namespace Tests\Feature;

use App\Models\GroundTruthReport;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\User;
use App\Notifications\HighRiskWarningNotification;
use App\Notifications\NewReportReviewNotification;
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

    public function test_quiet_hours_delays_non_critical_notification(): void
    {
        Notification::fake();

        $region = $this->makeRegion('Kabupaten Notif Quiet');
        $reporter = $this->makeUser('warga');
        $operator = $this->makeUser('bpbd_operator', $region->id);
        $this->setQuietHoursSpanningNow($operator);
        $report = $this->makeReport($reporter, $region);

        app(NotificationService::class)->notifyNewReportForReview($report);

        Notification::assertSentTo(
            $operator,
            NewReportReviewNotification::class,
            fn (NewReportReviewNotification $notification) => $notification->delay !== null,
        );
    }

    public function test_critical_high_risk_warning_bypasses_quiet_hours(): void
    {
        Notification::fake();

        $region = $this->makeRegion('Kabupaten Notif Kritis');
        $warga = $this->makeUser('warga');
        $this->setQuietHoursSpanningNow($warga);
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

        $operatorMatch = $this->makeUser('bpbd_operator', $regionA->id);
        $operatorOther = $this->makeUser('bpbd_operator', $regionB->id);
        $wargaSubscribed = $this->makeUser('warga');
        $this->setMonitoredRegions($wargaSubscribed, [$regionA->village]);
        $wargaElsewhere = $this->makeUser('warga');
        $this->setMonitoredRegions($wargaElsewhere, ['Kelurahan Antah Berantah']);
        $admin = $this->makeUser('admin');

        app(NotificationService::class)
            ->notifyHighRiskPredictions(CarbonImmutable::today()->toDateString());

        Notification::assertSentTo($operatorMatch, HighRiskWarningNotification::class);
        Notification::assertNotSentTo($operatorOther, HighRiskWarningNotification::class);
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

    private function setQuietHoursSpanningNow(User $user): void
    {
        $settings = app(NotificationService::class)->settings($user->id);
        $settings->quiet_start = now()->subHours(2)->format('H:i');
        $settings->quiet_end = now()->addHours(2)->format('H:i');
        $settings->save();
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
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Notif Test',
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
            'report_code' => 'NOTIF-'.Str::upper(Str::random(8)),
            'user_id' => $reporter->id,
            'region_id' => $region->id,
            'latitude' => -5.445,
            'longitude' => 105.260,
            'severity' => 'sedang',
            'water_height_cm' => 20,
            'incident_time' => now(),
            'description' => 'Laporan uji perilaku notifikasi.',
            'status' => 'menunggu',
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
