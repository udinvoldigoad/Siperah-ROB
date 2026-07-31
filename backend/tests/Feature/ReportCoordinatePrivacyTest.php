<?php

namespace Tests\Feature;

use App\Models\GroundTruthReport;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Privasi koordinat pelapor: jalur PUBLIK (tanpa login) hanya boleh menerima
 * koordinat yang dibulatkan 3 desimal (~110 m) agar titik tidak menunjuk rumah
 * pelapor, sementara pihak berwenang (operator/admin/pemilik laporan) tetap
 * menerima presisi penuh untuk respons lapangan.
 */
final class ReportCoordinatePrivacyTest extends TestCase
{
    use DatabaseTransactions;

    // Sengaja punya 6 desimal agar pembulatan terlihat jelas.
    private const EXACT_LAT = -5.445123;
    private const EXACT_LON = 105.260987;
    private const ROUNDED_LAT = -5.445;
    private const ROUNDED_LON = 105.261;

    public function test_public_mode_awam_returns_only_approximate_coordinates(): void
    {
        [, $report] = $this->makeRegionWithReport();

        $reports = $this->getJson('/api/public/mode-awam?lat=-5.445&lon=105.260')
            ->assertOk()
            ->json('data.nearby_reports') ?? [];

        // Saring ke laporan uji ini saja (DB test juga berisi data demo seed).
        $mine = collect($reports)->firstWhere('report_code', $report->report_code);
        $this->assertNotNull($mine, 'Laporan uji harus muncul agar uji privasi bermakna.');

        $this->assertSame(self::ROUNDED_LAT, (float) $mine['latitude'], 'Koordinat presisi penuh bocor ke publik.');
        $this->assertSame(self::ROUNDED_LON, (float) $mine['longitude'], 'Koordinat presisi penuh bocor ke publik.');
    }

    public function test_public_map_report_points_are_rounded(): void
    {
        [, $report] = $this->makeRegionWithReport();

        $features = $this->getJson('/api/public/map')->assertOk()->json('data.reports.features') ?? [];
        $mine = collect($features)->first(fn ($f) => ($f['properties']['report_code'] ?? null) === $report->report_code);
        $this->assertNotNull($mine, 'Titik laporan uji harus ada agar uji privasi bermakna.');

        [$lon, $lat] = $mine['geometry']['coordinates'];
        $this->assertSame(self::ROUNDED_LON, (float) $lon);
        $this->assertSame(self::ROUNDED_LAT, (float) $lat);
    }

    public function test_authenticated_operator_still_receives_precise_coordinates(): void
    {
        [$region, $report] = $this->makeRegionWithReport();
        $admin = User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Admin Privasi Test',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => 'admin',
            'status' => 'aktif',
        ]);

        $this->actingAs($admin)
            ->getJson("/api/reports/{$report->id}")
            ->assertOk()
            // Pihak berwenang WAJIB tetap dapat presisi penuh untuk respons lapangan.
            ->assertJsonPath('data.latitude', fn ($v) => (float) $v === self::EXACT_LAT)
            ->assertJsonPath('data.longitude', fn ($v) => (float) $v === self::EXACT_LON);

        unset($region);
    }

    /** @return array{0: Region, 1: GroundTruthReport} */
    private function makeRegionWithReport(): array
    {
        $id = (string) Str::uuid();
        $geometry = 'MULTIPOLYGON(((105.25 -5.455,105.27 -5.455,105.27 -5.435,105.25 -5.435,105.25 -5.455)))';
        $postgis = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgis ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', 'Kabupaten Privasi Test', 'Kecamatan Privasi', 'Kelurahan Privasi', {$geometrySql}, 1000, true, 'FeatureTest', 'coordinate-privacy-test', 'demo', now(), now())",
            [$id, $geometry],
        );
        $region = Region::findOrFail($id);

        $reporter = User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Pelapor Privasi',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => 'warga',
            'status' => 'aktif',
        ]);

        $report = GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => 'PRIV-'.Str::upper(Str::random(8)),
            'user_id' => $reporter->id,
            'region_id' => $region->id,
            'latitude' => self::EXACT_LAT,
            'longitude' => self::EXACT_LON,
            'severity' => 'sedang',
            'water_height_cm' => 25,
            'incident_time' => now(),
            'description' => 'Laporan uji privasi koordinat.',
            'status' => 'divalidasi',
            'validated_at' => now(),
        ]);

        return [$region, $report];
    }
}
