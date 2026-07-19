<?php

namespace Tests\Feature;

use App\Models\GroundTruthReport;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Peta publik: struktur GeoJSON (regions/reports/layers), filter kabupaten,
 * horizon tanggal (default = tanggal prediksi terdekat >= hari ini, fallback ke
 * tanggal terakhir), tanggal eksplisit, dan export CSV dengan filter yang sama.
 *
 * Respons /public/map di-cache 15 menit dengan key filter — cache array test
 * bertahan antar test satu proses, jadi setiap test flush cache + pakai nama
 * kabupaten unik agar tidak membaca payload basi milik test lain.
 */
final class PublicMapTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_map_returns_geojson_regions_reports_and_layer_collections(): void
    {
        $region = $this->insertRegion('Kabupaten Peta GeoJSON');
        $this->makePrediction($region, CarbonImmutable::today(), 'tinggi', 72.5);
        $report = $this->makeValidatedReport($region);

        $response = $this->getJson('/api/public/map?regency=Kabupaten%20Peta%20GeoJSON')
            ->assertOk()
            ->assertJsonPath('data.regions.type', 'FeatureCollection')
            ->assertJsonPath('data.reports.type', 'FeatureCollection')
            ->assertJsonPath('data.regions.features.0.type', 'Feature')
            ->assertJsonPath('data.regions.features.0.properties.regency', 'Kabupaten Peta GeoJSON')
            ->assertJsonPath('data.regions.features.0.properties.risk_class', 'tinggi')
            ->assertJsonPath('data.regions.features.0.properties.risk_probability', 72.5)
            ->assertJsonPath('data.reports.features.0.geometry.type', 'Point')
            ->assertJsonPath('data.reports.features.0.properties.report_code', $report->report_code)
            ->assertJsonStructure([
                'data' => [
                    'regions', 'reports',
                    'layers' => ['tidal_stations', 'coastlines', 'critical_infrastructure', 'evacuation_routes'],
                    'active_warning', 'data_freshness' => ['last_generated_at', 'is_stale'],
                ],
            ]);

        // GeoJSON pakai urutan [longitude, latitude].
        $coordinates = $response->json('data.reports.features.0.geometry.coordinates');
        $this->assertEqualsWithDelta(105.260, $coordinates[0], 0.001);
        $this->assertEqualsWithDelta(-5.445, $coordinates[1], 0.001);
        $this->assertNotNull($response->json('data.regions.features.0.geometry'));
    }

    public function test_map_filters_predictions_and_reports_by_regency(): void
    {
        $regionA = $this->insertRegion('Kabupaten Filter Peta A');
        $regionB = $this->insertRegion('Kabupaten Filter Peta B');
        $this->makePrediction($regionA, CarbonImmutable::today(), 'tinggi', 70);
        $this->makePrediction($regionB, CarbonImmutable::today(), 'rendah', 10);
        $reportA = $this->makeValidatedReport($regionA);
        $reportB = $this->makeValidatedReport($regionB);

        $this->getJson('/api/public/map?regency=Kabupaten%20Filter%20Peta%20A')
            ->assertOk()
            ->assertJsonCount(1, 'data.regions.features')
            ->assertJsonPath('data.regions.features.0.properties.regency', 'Kabupaten Filter Peta A')
            ->assertJsonFragment(['report_code' => $reportA->report_code])
            ->assertJsonMissing(['report_code' => $reportB->report_code]);
    }

    public function test_map_horizon_defaults_to_nearest_upcoming_prediction_date(): void
    {
        $region = $this->insertRegion('Kabupaten Horizon Depan');
        $this->makePrediction($region, CarbonImmutable::yesterday(), 'rendah', 15);
        $this->makePrediction($region, CarbonImmutable::tomorrow(), 'tinggi', 65);

        $this->getJson('/api/public/map?regency=Kabupaten%20Horizon%20Depan')
            ->assertOk()
            ->assertJsonCount(1, 'data.regions.features')
            ->assertJsonPath('data.regions.features.0.properties.risk_class', 'tinggi');
    }

    public function test_map_horizon_falls_back_to_latest_past_date_when_no_upcoming(): void
    {
        $region = $this->insertRegion('Kabupaten Horizon Lampau');
        $this->makePrediction($region, CarbonImmutable::today()->subDays(10), 'rendah', 12);
        $this->makePrediction($region, CarbonImmutable::today()->subDays(3), 'sedang', 45);

        $this->getJson('/api/public/map?regency=Kabupaten%20Horizon%20Lampau')
            ->assertOk()
            ->assertJsonCount(1, 'data.regions.features')
            ->assertJsonPath('data.regions.features.0.properties.risk_class', 'sedang');
    }

    public function test_map_with_explicit_date_returns_only_that_day(): void
    {
        $region = $this->insertRegion('Kabupaten Tanggal Eksplisit');
        $yesterday = CarbonImmutable::yesterday();
        $this->makePrediction($region, $yesterday, 'sedang', 40);
        $this->makePrediction($region, CarbonImmutable::today(), 'tinggi', 70);

        $this->getJson('/api/public/map?regency=Kabupaten%20Tanggal%20Eksplisit&date='.$yesterday->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'data.regions.features')
            ->assertJsonPath('data.regions.features.0.properties.risk_class', 'sedang');
    }

    public function test_map_export_streams_csv_with_same_regency_filter(): void
    {
        $regionA = $this->insertRegion('Kabupaten Export Peta A');
        $regionB = $this->insertRegion('Kabupaten Export Peta B');
        $this->makePrediction($regionA, CarbonImmutable::today(), 'tinggi', 70);
        $this->makePrediction($regionB, CarbonImmutable::today(), 'rendah', 10);

        $export = $this->get('/api/public/map/export?regency=Kabupaten%20Export%20Peta%20A')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Kabupaten Export Peta A', $export->streamedContent());
        $this->assertStringNotContainsString('Kabupaten Export Peta B', $export->streamedContent());

        // Export memakai date_format:Y-m-d ketat, format lain ditolak.
        $this->getJson('/api/public/map/export?date=19-07-2026')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    private function makePrediction(Region $region, CarbonImmutable $date, string $riskClass, float $probability): Prediction
    {
        return Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => $date->toDateString(),
            'risk_probability' => $probability,
            'risk_class' => $riskClass,
            'confidence_score' => 85,
            'max_tidal_height' => 1.3,
            'peak_time' => '17:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'public-map-test',
            'provenance_status' => 'demo',
        ]);
    }

    private function makeValidatedReport(Region $region): GroundTruthReport
    {
        $reporter = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Pelapor Peta Test',
            'email' => Str::uuid().'@example.test',
            'role' => 'warga',
            'status' => 'aktif',
        ]);

        return GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => 'PETA-'.Str::upper(Str::random(10)),
            'user_id' => $reporter->id,
            'region_id' => $region->id,
            'latitude' => -5.445,
            'longitude' => 105.260,
            'severity' => 'sedang',
            'water_height_cm' => 30,
            'incident_time' => now(),
            'description' => 'Laporan uji peta publik.',
            'status' => 'divalidasi',
            'validated_at' => now(),
        ]);
    }

    private function insertRegion(string $regency): Region
    {
        $id = (string) Str::uuid();
        $geometry = 'MULTIPOLYGON(((105.25 -5.455,105.27 -5.455,105.27 -5.435,105.25 -5.435,105.25 -5.455)))';
        $postgisInstalled = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgisInstalled ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', ?, 'Kecamatan Peta', 'Kelurahan Peta', {$geometrySql}, 1500, true, 'FeatureTest', 'public-map-test', 'demo', now(), now())",
            [$id, $regency, $geometry],
        );

        return Region::findOrFail($id);
    }
}
