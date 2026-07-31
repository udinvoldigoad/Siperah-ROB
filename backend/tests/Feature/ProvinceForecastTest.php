<?php

namespace Tests\Feature;

use App\Models\Prediction;
use App\Models\Region;
use App\Support\AppTime;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * `/public/province/forecast` adalah endpoint anonim ber-rate-limit longgar.
 *
 * Dulu ia mengembalikan satu baris per kelurahan per hari (~321 wilayah x 30
 * hari) tanpa pagination, dan tiap baris melewati RegionResource yang menghitung
 * `is_monitored` lewat `predictions()->exists()` — satu permintaan bisa memicu
 * ribuan query. Test ini mengunci bentuk agregat per tanggal DAN batas jumlah
 * query-nya, karena bentuk yang benar saja tak cukup: regresi N+1 bisa kembali
 * tanpa mengubah bentuk respons sama sekali.
 */
final class ProvinceForecastTest extends TestCase
{
    use DatabaseTransactions;

    public function test_forecast_is_aggregated_per_date_not_per_village(): void
    {
        $regency = 'Kabupaten Prakiraan '.Str::upper(Str::random(6));
        $today = AppTime::todayString();

        // Tiga kelurahan pada TANGGAL YANG SAMA -> harus menyusut jadi 1 baris.
        // Nilai sengaja berdesimal agar pembulatan 2 angka ikut teruji.
        $this->makePrediction($this->insertRegion($regency), $today, 'sangat_tinggi', 90.5);
        $this->makePrediction($this->insertRegion($regency), $today, 'tinggi', 70.25);
        $this->makePrediction($this->insertRegion($regency), $today, 'rendah', 20.0);

        $response = $this->getJson('/api/public/province/forecast?regency='.urlencode($regency))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.prediction_date', $today)
            ->assertJsonPath('data.0.region_count', 3)
            ->assertJsonPath('data.0.critical_count', 1)      // sangat_tinggi
            ->assertJsonPath('data.0.high_risk_count', 2)     // tinggi + sangat_tinggi
            ->assertJsonPath('data.0.max_probability', 90.5)
            ->assertJsonPath('data.0.avg_probability', 60.25) // (90.5+70.25+20)/3
            ->assertJsonPath('meta.regency', $regency)
            ->assertJsonPath('meta.days', 1);

        // Tak ada lagi baris per kelurahan: identitas wilayah tidak dibocorkan.
        $row = $response->json('data.0');
        self::assertArrayNotHasKey('region', $row);
        self::assertArrayNotHasKey('id', $row);
    }

    public function test_response_size_and_query_count_stay_bounded(): void
    {
        $regency = 'Kabupaten Beban '.Str::upper(Str::random(6));
        $start = AppTime::today();

        // 5 kelurahan x 10 hari = 50 baris mentah; hasilnya harus tetap 10.
        for ($r = 0; $r < 5; $r++) {
            $region = $this->insertRegion($regency);
            for ($d = 0; $d < 10; $d++) {
                $this->makePrediction($region, $start->addDays($d)->toDateString(), 'sedang', 40.0 + $d);
            }
        }

        DB::flushQueryLog();
        DB::enableQueryLog();
        $response = $this->getJson('/api/public/province/forecast?regency='.urlencode($regency))->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $response->assertJsonCount(10, 'data');

        // Baseline terukur: 1 query (agregasi tunggal) untuk 50 baris mentah.
        // Ambang 5 memberi ruang bila cache store dipindah ke database
        // (SELECT + INSERT tambahan), tapi tetap jauh di bawah pola N+1.
        self::assertLessThanOrEqual(
            5,
            $queries,
            "Prakiraan provinsi menjalankan {$queries} query — indikasi N+1 kembali.",
        );
    }

    public function test_window_is_capped_at_thirty_days_from_today(): void
    {
        $regency = 'Kabupaten Jendela '.Str::upper(Str::random(6));
        $region = $this->insertRegion($regency);
        $today = AppTime::today();

        $this->makePrediction($region, $today->subDay()->toDateString(), 'tinggi', 80.0);      // kemarin
        $this->makePrediction($region, $today->toDateString(), 'tinggi', 80.0);                // hari ini
        $this->makePrediction($region, $today->addDays(29)->toDateString(), 'tinggi', 80.0);   // hari ke-30
        $this->makePrediction($region, $today->addDays(30)->toDateString(), 'tinggi', 80.0);   // di luar

        $dates = collect(
            $this->getJson('/api/public/province/forecast?regency='.urlencode($regency))->assertOk()->json('data'),
        )->pluck('prediction_date')->all();

        self::assertSame([
            $today->toDateString(),
            $today->addDays(29)->toDateString(),
        ], $dates);
    }

    public function test_regency_filter_excludes_other_regencies(): void
    {
        $mine = 'Kabupaten Punya '.Str::upper(Str::random(6));
        $other = 'Kabupaten Lain '.Str::upper(Str::random(6));
        $today = AppTime::todayString();

        $this->makePrediction($this->insertRegion($mine), $today, 'tinggi', 75.5);
        $this->makePrediction($this->insertRegion($other), $today, 'sangat_tinggi', 95.5);

        $this->getJson('/api/public/province/forecast?regency='.urlencode($mine))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.region_count', 1)
            ->assertJsonPath('data.0.max_probability', 75.5);
    }

    private function makePrediction(Region $region, string $date, string $riskClass, float $probability): Prediction
    {
        return Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => $date,
            'risk_probability' => $probability,
            'risk_class' => $riskClass,
            'confidence_score' => 85,
            'max_tidal_height' => 1.3,
            'peak_time' => '17:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'province-forecast-test',
            'provenance_status' => 'demo',
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
             VALUES (?, 'Lampung', ?, 'Kecamatan Prakiraan', ?, {$geometrySql}, 1500, true, 'FeatureTest', 'province-forecast-test', 'demo', now(), now())",
            [$id, $regency, 'Kelurahan '.Str::upper(Str::random(5)), $geometry],
        );

        return Region::findOrFail($id);
    }
}
