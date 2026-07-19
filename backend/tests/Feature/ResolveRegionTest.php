<?php

namespace Tests\Feature;

use App\Models\Prediction;
use App\Models\Region;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * /public/resolve-region: menandai titik dalam/luar pantauan lewat tiga jalur —
 * region pesisir (coastal_flag), region non-pesisir yang punya prediksi, dan
 * kedekatan <5 km (ST_DWithin) dari region terpantau lain; titik di luar batas
 * administrasi Lampung mengembalikan data null dengan pesan jelas.
 *
 * Titik (-5.125, 105.125) dipilih karena bebas dari wilayah terpantau nyata di
 * DB dev dalam radius 5 km (dipakai juga oleh test mode awam "outside"); region
 * buatan tiap test di-rollback sehingga tidak saling mengganggu.
 */
final class ResolveRegionTest extends TestCase
{
    use DatabaseTransactions;

    private const LAT = -5.125;
    private const LON = 105.125;

    public function test_point_inside_coastal_region_is_monitored(): void
    {
        $region = $this->insertRegion(self::LAT, self::LON, coastal: true);

        $this->getJson('/api/public/resolve-region?lat='.self::LAT.'&lon='.self::LON)
            ->assertOk()
            ->assertJsonPath('data.id', $region->id)
            ->assertJsonPath('data.is_monitored', true)
            ->assertJsonPath('message', null);
    }

    public function test_point_in_non_coastal_region_without_predictions_is_not_monitored(): void
    {
        $region = $this->insertRegion(self::LAT, self::LON, coastal: false);

        $this->getJson('/api/public/resolve-region?lat='.self::LAT.'&lon='.self::LON)
            ->assertOk()
            ->assertJsonPath('data.id', $region->id)
            ->assertJsonPath('data.is_monitored', false);
    }

    public function test_non_coastal_region_with_predictions_counts_as_monitored(): void
    {
        $region = $this->insertRegion(self::LAT, self::LON, coastal: false);
        Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => CarbonImmutable::today()->toDateString(),
            'risk_probability' => 55,
            'risk_class' => 'sedang',
            'confidence_score' => 80,
            'max_tidal_height' => 1.1,
            'peak_time' => '16:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'resolve-region-test',
            'provenance_status' => 'demo',
        ]);

        $this->getJson('/api/public/resolve-region?lat='.self::LAT.'&lon='.self::LON)
            ->assertOk()
            ->assertJsonPath('data.id', $region->id)
            ->assertJsonPath('data.is_monitored', true);
    }

    public function test_point_within_5km_of_monitored_region_is_monitored(): void
    {
        $region = $this->insertRegion(self::LAT, self::LON, coastal: false);
        // Region pesisir terpisah ~3,3 km di timur (tepi barat poligonnya di
        // 105.155): masuk radius ST_DWithin 5 km walau region admin titiknya
        // bukan pesisir. Tanpa PostGIS jalur ini pakai fallback non-spasial,
        // jadi test dilewati agar tidak memberi rasa aman palsu.
        if (!DB::table('pg_extension')->where('extname', 'postgis')->exists()) {
            $this->markTestSkipped('Butuh PostGIS untuk uji radius ST_DWithin.');
        }
        $this->insertRegion(self::LAT, self::LON + 0.040, coastal: true);

        $this->getJson('/api/public/resolve-region?lat='.self::LAT.'&lon='.self::LON)
            ->assertOk()
            ->assertJsonPath('data.id', $region->id)
            ->assertJsonPath('data.is_monitored', true);
    }

    public function test_point_outside_lampung_administration_returns_null_with_message(): void
    {
        $this->getJson('/api/public/resolve-region?lat=0&lon=0')
            ->assertOk()
            ->assertJsonPath('data', null)
            ->assertJsonPath('message', 'Koordinat berada di luar batas administrasi Lampung yang tersedia.');
    }

    public function test_coordinates_are_required_and_range_checked(): void
    {
        $this->getJson('/api/public/resolve-region')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lat', 'lon']);

        $this->getJson('/api/public/resolve-region?lat=95&lon=200')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lat', 'lon']);
    }

    private function insertRegion(float $latitude, float $longitude, bool $coastal): Region
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
             VALUES (?, 'Lampung', 'Kabupaten Resolve Test', ?, ?, {$geometrySql}, 1200, ?, 'FeatureTest', 'resolve-region-test', 'demo', now(), now())",
            [
                $id,
                $coastal ? 'Pantauan Resolve' : 'Non Pantauan Resolve',
                $coastal ? 'Dalam Pantauan Resolve' : 'Luar Pantauan Resolve',
                $geometry,
                $coastal,
            ],
        );

        return Region::findOrFail($id);
    }
}
