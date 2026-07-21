<?php

namespace Tests\Feature;

use App\Models\ApiKey;
use App\Models\AuditLog;
use App\Models\GroundTruthReport;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\ReportPhoto;
use App\Models\User;
use App\Services\AuditService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ApiFoundationTest extends TestCase
{
    use DatabaseTransactions;
    public function test_health_endpoint_is_available(): void
    {
        $this->getJson('/')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_login_requires_valid_credentials_shape(): void
    {
        $this->postJson('/api/auth/login', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_login_returns_status_specific_message_for_inactive_accounts(): void
    {
        foreach (['menunggu', 'nonaktif', 'ditolak'] as $status) {
            $email = Str::uuid().'@example.test';
            User::create([
                'id' => (string) Str::uuid(),
                'name' => 'Status Test',
                'email' => $email,
                'password_hash' => bcrypt('password123'),
                'role' => 'warga',
                'status' => $status,
            ]);

            $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
                ->assertStatus(403)
                ->assertJsonPath('account_status', $status)
                ->assertJsonMissingPath('access_token');
        }
    }

    public function test_public_map_rejects_invalid_date_before_querying_database(): void
    {
        $this->getJson('/api/public/map?date=bukan-tanggal')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    public function test_public_predictions_validates_filter_shape(): void
    {
        // per_page dibatasi 1..1000 (dashboard provinsi butuh 1000); 1001 harus ditolak.
        $this->getJson('/api/public/predictions?date=12-07-2026&per_page=1001')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date', 'per_page']);
    }

    public function test_mode_awam_requires_complete_coordinate_pair(): void
    {
        $this->getJson('/api/public/mode-awam?lat=-5.45')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lon']);
    }

    public function test_mode_awam_marks_point_inside_monitoring_area(): void
    {
        $region = $this->insertRegionForPoint(-5.445, 105.260, true);
        Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => CarbonImmutable::today()->toDateString(),
            'risk_probability' => 72.5,
            'risk_class' => 'tinggi',
            'confidence_score' => 88.0,
            'max_tidal_height' => 1.45,
            'peak_time' => '17:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'mode-awam-inside-test',
            'provenance_status' => 'demo',
        ]);
        $reporter = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Mode Awam Reporter',
            'email' => Str::uuid().'@example.test',
            'role' => 'warga',
            'status' => 'aktif',
        ]);
        $reportCode = 'TEST-IN-'.Str::upper(Str::random(8));
        GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => $reportCode,
            'user_id' => $reporter->id,
            'region_id' => $region->id,
            'latitude' => -5.4451,
            'longitude' => 105.2601,
            'severity' => 'sedang',
            'water_height_cm' => 25,
            'incident_time' => now(),
            'description' => 'Laporan dekat untuk mode awam.',
            'status' => 'divalidasi',
            'validated_at' => now(),
        ]);

        $this->getJson('/api/public/mode-awam?lat=-5.445&lon=105.260')
            ->assertOk()
            ->assertJsonPath('data.is_monitored', true)
            ->assertJsonPath('data.monitoring_status', 'inside_monitoring_area')
            ->assertJsonPath('data.status_label', 'Masuk wilayah pantauan rob')
            ->assertJsonFragment(['report_code' => $reportCode]);
    }

    public function test_mode_awam_marks_administrative_point_outside_monitoring_without_fake_location(): void
    {
        $region = $this->insertRegionForPoint(-5.125, 105.125, false);

        $this->getJson('/api/public/mode-awam?lat=-5.125&lon=105.125')
            ->assertOk()
            ->assertJsonPath('data.is_monitored', false)
            ->assertJsonPath('data.monitoring_status', 'outside_monitoring_area')
            ->assertJsonPath('data.status_label', 'Di luar wilayah pantauan prediksi rob')
            ->assertJsonPath('data.region.id', $region->id)
            ->assertJsonPath('data.risk_probability', 0);
    }

    public function test_mode_awam_returns_clear_message_for_point_outside_available_lampung_boundaries(): void
    {
        $this->getJson('/api/public/mode-awam?lat=0&lon=0')
            ->assertOk()
            ->assertJsonPath('data', null)
            ->assertJsonPath('message', 'Lokasi yang dipilih belum ada di data administrasi Lampung. Coba geser pin ke daratan Lampung terdekat.');
    }

    public function test_protected_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/reports')->assertUnauthorized();
    }

    public function test_research_v1_requires_api_key_instead_of_sanctum(): void
    {
        $this->getJson('/api/v1/predictions/daily')
            ->assertUnauthorized()
            ->assertJsonPath('data', null);
    }

    public function test_valid_scoped_api_key_can_access_research_endpoint(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(), 'name' => 'Integration Researcher',
            'email' => Str::uuid().'@example.test', 'role' => 'peneliti', 'status' => 'aktif',
        ]);
        $rawKey = 'spr_'.Str::random(40);
        ApiKey::create([
            'id' => (string) Str::uuid(), 'user_id' => $user->id,
            'key_hash' => hash('sha256', $rawKey), 'key_prefix' => substr($rawKey, 0, 12).'...',
            'status' => 'aktif', 'scopes' => ['predictions:read'], 'use_count' => 0,
        ]);

        $this->withHeader('X-API-Key', $rawKey)
            ->getJson('/api/v1/predictions/daily?per_page=1')
            ->assertOk()
            ->assertHeader('X-Api-Version', 'v1')
            ->assertJsonStructure(['data', 'meta']);
    }

    public function test_notification_settings_accept_frontend_time_and_event_contract(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(), 'name' => 'Notification User',
            'email' => Str::uuid().'@example.test', 'role' => 'warga', 'status' => 'aktif',
        ]);
        $this->actingAs($user);

        $this->putJson('/api/notifications/settings', [
            'channels' => ['browser', 'email'],
            'event_types' => ['bahaya_sangat_tinggi', 'pembaruan_model'],
            'quiet_start' => '22:00:00', 'quiet_end' => '06:00:00',
            'monitored_regions' => ['Panjang Utara'],
        ])->assertOk()->assertJsonPath('data.user_id', $user->id);
    }

    public function test_inactive_user_token_is_rejected(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(), 'name' => 'Inactive User',
            'email' => Str::uuid().'@example.test', 'role' => 'warga', 'status' => 'nonaktif',
        ]);
        $this->actingAs($user);

        $this->getJson('/api/auth/me')->assertForbidden();
    }

    public function test_report_outside_monitoring_enters_triage_queue_for_operator(): void
    {
        $outsideRegion = $this->insertRegionForPoint(-4.500, 104.500, false);
        $operatorRegion = $this->insertRegionForPoint(-4.800, 104.800, true);
        $citizen = $this->createUser('warga');
        $operator = $this->createUser('bpbd_operator', $operatorRegion->id);

        $this->actingAs($citizen);
        $response = $this->postJson('/api/reports', [
            'latitude' => -4.500,
            'longitude' => 104.500,
            'water_height_cm' => 20,
            'incident_time' => now()->toIso8601String(),
            'description' => 'Genangan test di luar wilayah pantauan.',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'perlu_review')
            ->assertJsonPath('data.is_within_monitoring_area', false)
            ->assertJsonPath('data.region.id', $outsideRegion->id);

        $reportCode = $response->json('data.report_code');
        $this->assertDatabaseHas('ground_truth_reports', [
            'report_code' => $reportCode,
            'is_within_monitoring_area' => false,
        ]);

        $this->actingAs($operator);
        $this->getJson('/api/reports?status=menunggu,perlu_review')
            ->assertOk()
            ->assertJsonFragment(['report_code' => $reportCode]);
    }

    public function test_report_duplicate_near_same_time_and_location_is_rejected(): void
    {
        $region = $this->insertRegionForPoint(-4.600, 104.600, true);
        Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => CarbonImmutable::today()->toDateString(),
            'risk_probability' => 62,
            'risk_class' => 'tinggi',
            'confidence_score' => 80,
            'max_tidal_height' => 1.2,
            'peak_time' => '17:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'duplicate-test',
            'provenance_status' => 'demo',
        ]);
        $citizen = $this->createUser('warga');
        $incidentTime = now()->toIso8601String();
        $payload = [
            'latitude' => -4.600,
            'longitude' => 104.600,
            'water_height_cm' => 45,
            'incident_time' => $incidentTime,
            'description' => 'Genangan duplikat test.',
        ];

        $this->actingAs($citizen);
        $this->postJson('/api/reports', $payload)->assertCreated();
        $this->postJson('/api/reports', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['latitude']);
    }

    public function test_report_photo_contract_rejects_too_many_or_wrong_mime_files(): void
    {
        $citizen = $this->createUser('warga');
        $this->actingAs($citizen);

        $basePayload = [
            'latitude' => -5.445,
            'longitude' => 105.260,
            'water_height_cm' => 15,
            'incident_time' => now()->toIso8601String(),
            'description' => 'Validasi foto laporan.',
        ];

        $this->post('/api/reports', [
            ...$basePayload,
            'photos' => [
                UploadedFile::fake()->image('1.jpg'),
                UploadedFile::fake()->image('2.jpg'),
                UploadedFile::fake()->image('3.jpg'),
                UploadedFile::fake()->image('4.jpg'),
                UploadedFile::fake()->image('5.jpg'),
                UploadedFile::fake()->image('6.jpg'),
            ],
        ])->assertJsonValidationErrors('photos');

        $this->post('/api/reports', [
            ...$basePayload,
            'photos' => [UploadedFile::fake()->create('document.pdf', 100, 'application/pdf')],
        ])->assertJsonValidationErrors('photos.0');
    }

    public function test_validated_report_is_visible_on_public_map_and_research_dataset(): void
    {
        $region = $this->insertRegionForPoint(-4.700, 104.700, true);
        Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => CarbonImmutable::today()->toDateString(),
            'risk_probability' => 70,
            'risk_class' => 'tinggi',
            'confidence_score' => 85,
            'max_tidal_height' => 1.4,
            'peak_time' => '18:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'visibility-test',
            'provenance_status' => 'demo',
        ]);
        $citizen = $this->createUser('warga');
        $operator = $this->createUser('bpbd_operator', $region->id);

        $this->actingAs($citizen);
        $response = $this->postJson('/api/reports', [
            'latitude' => -4.700,
            'longitude' => 104.700,
            'water_height_cm' => 55,
            'incident_time' => now()->toIso8601String(),
            'description' => 'Laporan harus muncul setelah validasi.',
        ])->assertCreated();

        $reportId = $response->json('data.id');
        $reportCode = $response->json('data.report_code');

        $this->actingAs($operator);
        $this->postJson("/api/reports/{$reportId}/validate")->assertOk()
            ->assertJsonPath('data.status', 'divalidasi');

        $this->getJson('/api/public/map')
            ->assertOk()
            ->assertJsonFragment(['report_code' => $reportCode]);

        $rawKey = 'spr_'.Str::random(40);
        $researcher = $this->createUser('peneliti');
        ApiKey::create([
            'id' => (string) Str::uuid(),
            'user_id' => $researcher->id,
            'key_hash' => hash('sha256', $rawKey),
            'key_prefix' => substr($rawKey, 0, 12).'...',
            'status' => 'aktif',
            'scopes' => ['reports:read'],
            'use_count' => 0,
        ]);

        $this->withHeader('X-API-Key', $rawKey)
            ->getJson('/api/v1/reports?per_page=50')
            ->assertOk()
            ->assertJsonFragment(['report_code' => $reportCode]);
    }

    public function test_operator_only_sees_triage_reports_in_their_work_area(): void
    {
        $lampungSelatanMonitored = $this->insertRegionForPoint(-5.600, 105.300, true, 'Lampung Selatan');
        $lampungSelatanOutsideMonitoring = $this->insertRegionForPoint(-5.800, 105.100, false, 'Lampung Selatan');
        $bandarLampungMonitored = $this->insertRegionForPoint(-5.400, 105.250, true, 'Kota Bandar Lampung');
        $bandarLampungOutsideMonitoring = $this->insertRegionForPoint(-5.320, 105.180, false, 'Kota Bandar Lampung');
        $citizen = $this->createUser('warga');
        $operatorLampungSelatan = $this->createUser('bpbd_operator', $lampungSelatanMonitored->id);

        $this->actingAs($citizen);
        $insideOwnArea = $this->postJson('/api/reports', [
            'latitude' => -5.800,
            'longitude' => 105.100,
            'water_height_cm' => 25,
            'incident_time' => now()->toIso8601String(),
            'description' => 'Laporan triase Lampung Selatan.',
        ])->assertCreated()->json('data.report_code');

        $outsideOwnArea = $this->postJson('/api/reports', [
            'latitude' => -5.320,
            'longitude' => 105.180,
            'water_height_cm' => 25,
            'incident_time' => now()->addMinutes(10)->toIso8601String(),
            'description' => 'Laporan triase Bandar Lampung.',
        ])->assertCreated()->json('data.report_code');

        $this->actingAs($operatorLampungSelatan)
            ->getJson('/api/reports?status=menunggu,perlu_review&per_page=100')
            ->assertOk()
            ->assertJsonFragment(['report_code' => $insideOwnArea])
            ->assertJsonMissing(['report_code' => $outsideOwnArea]);

        $this->assertNotNull($bandarLampungMonitored);
        $this->assertNotNull($lampungSelatanOutsideMonitoring);
        $this->assertNotNull($bandarLampungOutsideMonitoring);
    }

    public function test_operator_summary_kpi_export_and_report_list_share_access_scope(): void
    {
        // Regency unik & tak lazim agar KPI tak tercampur data lain (termasuk
        // seed demo di DB test siperah_rob_test — lihat .env.testing).
        $uniqueRegency = 'Uji Operator Selatan';
        $operatorRegion = $this->insertRegionForPoint(-5.620, 105.320, true, $uniqueRegency);
        $outsideMonitoring = $this->insertRegionForPoint(-5.820, 105.120, false, $uniqueRegency);
        $citizen = $this->createUser('warga');
        $operator = $this->createUser('bpbd_operator', $operatorRegion->id);

        $this->actingAs($citizen);
        $reportCode = $this->postJson('/api/reports', [
            'latitude' => -5.820,
            'longitude' => 105.120,
            'water_height_cm' => 45,
            'incident_time' => now()->toIso8601String(),
            'description' => 'Laporan harus sama di KPI, daftar, dan export.',
        ])->assertCreated()->json('data.report_code');

        $this->actingAs($operator)
            ->getJson('/api/reports?status=menunggu,perlu_review&per_page=100')
            ->assertOk()
            ->assertJsonFragment(['report_code' => $reportCode]);

        $this->getJson('/api/dashboard/operator/summary')
            ->assertOk()
            ->assertJsonPath('data.pending_reports', 1)
            ->assertJsonPath('data.operator_regency', $uniqueRegency);

        $export = $this->get('/api/dashboard/operator/reports/export')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString($reportCode, $export->streamedContent());
    }

    public function test_report_photo_is_public_only_after_validation(): void
    {
        Storage::fake('public');
        $region = $this->insertRegionForPoint(-5.710, 105.310, true, 'Uji Foto Selatan');
        $owner = $this->createUser('warga');

        $report = GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => 'RB-FOTO-'.Str::upper(Str::random(5)),
            'user_id' => $owner->id,
            'region_id' => $region->id,
            'latitude' => -5.710,
            'longitude' => 105.310,
            'severity' => 'sedang',
            'water_height_cm' => 30,
            'incident_time' => now(),
            'description' => 'Uji gerbang akses foto laporan.',
            'status' => 'menunggu',
        ]);
        Storage::disk('public')->put('reports/uji-foto.jpg', 'binary-content');
        $photo = ReportPhoto::create([
            'id' => (string) Str::uuid(),
            'report_id' => $report->id,
            'file_url' => 'reports/uji-foto.jpg',
            'file_name' => 'uji-foto.jpg',
            'file_size' => 14,
            'mime_type' => 'image/jpeg',
            'uploaded_at' => now(),
        ]);
        $plainUrl = '/api/reports/photo/'.$photo->id;

        // Belum divalidasi + URL polos (tanpa tanda tangan) → ditolak.
        $this->get($plainUrl)->assertStatus(403);

        // Belum divalidasi + signed URL valid → boleh (mekanisme untuk pihak
        // berwenang; dibuat ReportResource, bekerja dengan tag <img>).
        $signedUrl = URL::temporarySignedRoute('reports.photo', now()->addHour(), ['photo' => $photo->id], false);
        $this->get($signedUrl)->assertOk();

        // Tanda tangan yang dirusak → ditolak.
        $this->get($signedUrl.'tamper')->assertStatus(403);

        // Setelah divalidasi → publik boleh tanpa tanda tangan (tampil di peta publik & Mode Awam).
        $report->update(['status' => 'divalidasi', 'validated_at' => now()]);
        $this->get($plainUrl)->assertOk();
    }

    public function test_perlu_review_report_flows_from_submission_to_validation(): void
    {
        // Region NON-pantau: laporan di sini otomatis berstatus perlu_review (triase).
        $region = $this->insertRegionForPoint(-5.905, 105.405, false, 'Uji Perlu Review');
        $citizen = $this->createUser('warga');
        $operator = $this->createUser('bpbd_operator', $region->id);

        // 1) Warga mengirim laporan di titik luar pantauan → status perlu_review.
        $created = $this->actingAs($citizen)->postJson('/api/reports', [
            'latitude' => -5.905,
            'longitude' => 105.405,
            'water_height_cm' => 25,
            'incident_time' => now()->toIso8601String(),
            'description' => 'Genangan di luar wilayah pantauan, perlu ditinjau operator.',
        ])->assertCreated()->assertJsonPath('data.status', 'perlu_review');
        $reportId = $created->json('data.id');
        $reportCode = $created->json('data.report_code');

        // 2) Muncul di antrean operator (perlu_review termasuk yang bisa diakses).
        $this->actingAs($operator)
            ->getJson('/api/reports?status=menunggu,perlu_review&per_page=50')
            ->assertOk()
            ->assertJsonFragment(['report_code' => $reportCode, 'status' => 'perlu_review']);

        // 3) Operator memvalidasi → status divalidasi & keluar dari antrean.
        $this->postJson("/api/reports/{$reportId}/validate")->assertOk();
        $this->getJson('/api/reports?status=menunggu,perlu_review&per_page=50')
            ->assertOk()
            ->assertJsonMissing(['report_code' => $reportCode]);
        $this->assertDatabaseHas('ground_truth_reports', ['id' => $reportId, 'status' => 'divalidasi']);
    }

    public function test_admin_edits_role_inline_and_operator_role_requires_region(): void
    {
        $admin = $this->createUser('admin');
        $region = $this->insertRegionForPoint(-5.520, 105.330, true, 'Uji Admin Edit');
        $target = $this->createUser('warga');

        $this->actingAs($admin);

        // Ubah role warga → peneliti (tak perlu wilayah) berhasil.
        $this->patchJson("/api/admin/users/{$target->id}", ['role' => 'peneliti'])->assertOk();
        $this->assertDatabaseHas('users', ['id' => $target->id, 'role' => 'peneliti']);

        // Ubah role → operator TANPA wilayah ditolak (invariant wilayah kerja operator).
        $this->patchJson("/api/admin/users/{$target->id}", ['role' => 'bpbd_operator'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['region_id']);

        // Dengan wilayah → berhasil.
        $this->patchJson("/api/admin/users/{$target->id}", ['role' => 'bpbd_operator', 'region_id' => $region->id])
            ->assertOk();
        $this->assertDatabaseHas('users', ['id' => $target->id, 'role' => 'bpbd_operator', 'region_id' => $region->id]);
    }

    public function test_province_dashboard_filters_trend_top_impacted_and_export_share_scope(): void
    {
        $region = $this->insertRegionForPoint(-5.910, 105.410, true, 'Kabupaten Filter Test');
        $otherRegion = $this->insertRegionForPoint(-5.930, 105.430, true, 'Kabupaten Lain Test');
        $provinceUser = $this->createUser('bpbd_provinsi');

        Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => '2026-07-01',
            'risk_probability' => 12,
            'risk_class' => 'rendah',
            'confidence_score' => 75,
            'max_tidal_height' => 0.4,
            'peak_time' => '06:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'province-filter-test',
            'provenance_status' => 'demo',
        ]);
        Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => '2026-07-15',
            'risk_probability' => 91,
            'risk_class' => 'sangat_tinggi',
            'confidence_score' => 92,
            'max_tidal_height' => 1.8,
            'peak_time' => '18:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'province-filter-test',
            'provenance_status' => 'demo',
        ]);
        Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $otherRegion->id,
            'prediction_date' => '2026-07-15',
            'risk_probability' => 99,
            'risk_class' => 'sangat_tinggi',
            'confidence_score' => 95,
            'max_tidal_height' => 2.1,
            'peak_time' => '19:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'province-filter-test-other',
            'provenance_status' => 'demo',
        ]);

        $this->actingAs($provinceUser);
        $this->getJson('/api/dashboard/province/summary?month=2026-07&regency=Kabupaten%20Filter%20Test')
            ->assertOk()
            ->assertJsonPath('data.latest_prediction_date', '2026-07-15')
            ->assertJsonPath('data.monitored_regencies', 1)
            ->assertJsonPath('data.regencies.0.regency', 'Kabupaten Filter Test')
            ->assertJsonPath('data.regencies.0.trend', 'naik')
            ->assertJsonPath('data.regencies.0.high_risk_delta', 1)
            ->assertJsonPath('data.top_impacted.0.regency', 'Kabupaten Filter Test')
            ->assertJsonPath('data.population_audit.with_population', 1);

        $export = $this->get('/api/dashboard/province/export?month=2026-07&regency=Kabupaten%20Filter%20Test')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Kabupaten Filter Test', $export->streamedContent());
        $this->assertStringNotContainsString('Kabupaten Lain Test', $export->streamedContent());
    }

    public function test_admin_can_create_user_export_users_and_researcher_workflow_is_visible(): void
    {
        $admin = $this->createUser('admin');
        $operatorRegion = $this->insertRegionForPoint(-5.710, 105.510, true, 'Kota Admin Test');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Operator Baru',
                'email' => 'operator-baru@example.test',
                'password' => 'password123',
                'role' => 'bpbd_operator',
                'status' => 'aktif',
                'region_id' => $operatorRegion->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'bpbd_operator')
            ->assertJsonPath('data.region_id', $operatorRegion->id);

        $this->postJson('/api/admin/users', [
            'name' => 'Peneliti Baru',
            'email' => 'peneliti-baru@example.test',
            'password' => 'password123',
            'role' => 'peneliti',
            'status' => 'menunggu',
            'institution' => 'Universitas Lampung',
        ])
            ->assertCreated()
            ->assertJsonPath('data.permission_workflow.status', 'menunggu')
            ->assertJsonPath('data.permission_workflow.institution', 'Universitas Lampung');

        $export = $this->get('/api/admin/users/export')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('operator-baru@example.test', $export->streamedContent());
    }

    public function test_admin_user_creation_requires_operator_region_and_researcher_institution(): void
    {
        $admin = $this->createUser('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Operator Tanpa Wilayah',
                'email' => 'operator-tanpa-wilayah@example.test',
                'password' => 'password123',
                'role' => 'bpbd_operator',
                'status' => 'aktif',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['region_id']);

        $this->postJson('/api/admin/users', [
            'name' => 'Peneliti Tanpa Instansi',
            'email' => 'peneliti-tanpa-instansi@example.test',
            'password' => 'password123',
            'role' => 'peneliti',
            'status' => 'menunggu',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['institution']);
    }

    public function test_negative_rbac_blocks_non_admin_and_non_bpbd_access(): void
    {
        $citizen = $this->createUser('warga');
        $researcher = $this->createUser('peneliti');

        $this->actingAs($citizen)
            ->getJson('/api/admin/users')
            ->assertForbidden();

        $this->actingAs($researcher)
            ->getJson('/api/dashboard/province/summary')
            ->assertForbidden();

        $this->actingAs($citizen)
            ->getJson('/api/research/datasets')
            ->assertForbidden();
    }

    public function test_audit_log_filters_search_and_export_are_consistent(): void
    {
        $admin = $this->createUser('admin');
        $citizen = $this->createUser('warga');

        AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $admin->id,
            'actor_name' => $admin->name,
            'actor_role' => 'admin',
            'action' => 'update_user',
            'target_resource' => 'users:target-admin',
            'outcome' => 'success',
            'ip_address' => '127.0.0.1',
            'created_at' => '2026-07-14 08:00:00',
            'updated_at' => '2026-07-14 08:00:00',
        ]);
        AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $citizen->id,
            'actor_name' => $citizen->name,
            'actor_role' => 'warga',
            'action' => 'create_report',
            'target_resource' => 'ground_truth_reports:test',
            'outcome' => 'success',
            'ip_address' => '127.0.0.1',
            'created_at' => '2026-07-10 08:00:00',
            'updated_at' => '2026-07-10 08:00:00',
        ]);

        $this->actingAs($admin)
            ->getJson("/api/admin/audit-logs?action=update_user&outcome=success&actor_role=admin&user_id={$admin->id}&from=2026-07-14&to=2026-07-14&search=TARGET-ADMIN")
            ->assertOk()
            ->assertJsonFragment(['action' => 'update_user'])
            ->assertJsonMissing(['action' => 'create_report']);

        $export = $this->get('/api/admin/audit-logs?format=csv&search=target-admin')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('users:target-admin', $export->streamedContent());
    }

    public function test_audit_service_is_fail_safe_when_storage_rejects_payload(): void
    {
        $request = Request::create('/test-audit-failsafe', 'POST');

        app(AuditService::class)->write($request, 'audit_fail_safe_test', 'not_a_valid_outcome', 'tests:audit');

        $this->assertTrue(true);
    }

    public function test_audit_prune_command_applies_retention_policy(): void
    {
        $admin = $this->createUser('admin');
        $oldId = (string) Str::uuid();
        $recentId = (string) Str::uuid();

        AuditLog::create([
            'id' => $oldId,
            'actor_user_id' => $admin->id,
            'actor_name' => $admin->name,
            'actor_role' => 'admin',
            'action' => 'old_audit',
            'target_resource' => 'tests:old',
            'outcome' => 'success',
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDays(400),
            'updated_at' => now()->subDays(400),
        ]);
        AuditLog::create([
            'id' => $recentId,
            'actor_user_id' => $admin->id,
            'actor_name' => $admin->name,
            'actor_role' => 'admin',
            'action' => 'recent_audit',
            'target_resource' => 'tests:recent',
            'outcome' => 'success',
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDays(10),
            'updated_at' => now()->subDays(10),
        ]);

        $this->assertSame(0, Artisan::call('audit:prune', ['--days' => 365]));

        $this->assertDatabaseMissing('audit_logs', ['id' => $oldId]);
        $this->assertDatabaseHas('audit_logs', ['id' => $recentId]);
    }

    private function insertRegionForPoint(float $latitude, float $longitude, bool $coastal, string $regency = 'Kabupaten Test'): Region
    {
        $id = (string) Str::uuid();
        $minLon = $longitude - 0.01;
        $maxLon = $longitude + 0.01;
        $minLat = $latitude - 0.01;
        $maxLat = $latitude + 0.01;
        $geometry = "MULTIPOLYGON((({$minLon} {$minLat},{$maxLon} {$minLat},{$maxLon} {$maxLat},{$minLon} {$maxLat},{$minLon} {$minLat})))";
        $postgisInstalled = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgisInstalled ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', ?, ?, ?, {$geometrySql}, 1000, ?, 'FeatureTest', 'mode-awam-regression', 'demo', now(), now())",
            [
                $id,
                $regency,
                $coastal ? 'Pantauan Test' : 'Non Pantauan Test',
                $coastal ? 'Dalam Pantauan Test' : 'Luar Pantauan Test',
                $geometry,
                $coastal,
            ],
        );

        return Region::findOrFail($id);
    }

    private function createUser(string $role, ?string $regionId = null): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Test',
            'email' => Str::uuid().'@example.test',
            'role' => $role,
            'status' => 'aktif',
            'region_id' => $regionId,
        ]);
    }
}
