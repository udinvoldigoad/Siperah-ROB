<?php

namespace Tests\Feature;

use App\Models\Prediction;
use App\Models\Region;
use App\Support\AppTime;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Off-by-one hari pada jam rawan rob subuh.
 *
 * `app.timezone` = UTC, jadi pukul 00:00–07:00 WIB masih terhitung "kemarin"
 * kalau tanggal tidak di-anchor eksplisit. Rentang itu memuat pipeline ML
 * (06:00 WIB) dan notifikasi risiko tinggi (06:30 WIB) — bila peta publik &
 * dashboard memakai hari UTC sementara notifikasi memakai WIB, warga diberi
 * peringatan untuk tanggal yang tidak tampil di peta.
 *
 * Waktu uji dikunci ke 23:30 UTC = 06:30 WIB keesokan harinya, momen persis
 * saat notifikasi dikirim.
 */
final class PreDawnDateAnchorTest extends TestCase
{
    use DatabaseTransactions;

    /** 06:30 WIB tanggal 28, tapi masih tanggal 27 menurut UTC. */
    private const UTC_NOW = '2026-07-27 23:30:00';
    private const WIB_TODAY = '2026-07-28';
    private const UTC_TODAY = '2026-07-27';

    protected function setUp(): void
    {
        parent::setUp();
        CarbonImmutable::setTestNow(CarbonImmutable::parse(self::UTC_NOW, 'UTC'));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_helper_and_utc_really_disagree_at_this_moment(): void
    {
        // Penjaga: kalau keduanya sama, seluruh test di file ini tak menguji apa pun.
        self::assertSame(self::WIB_TODAY, AppTime::todayString());
        self::assertSame(self::UTC_TODAY, CarbonImmutable::today('UTC')->toDateString());
    }

    public function test_public_map_shows_the_wib_day_not_the_utc_day(): void
    {
        $regency = 'Kabupaten Subuh '.Str::upper(Str::random(6));
        $region = $this->insertRegion($regency);

        // Dua prediksi berurutan: hari UTC (kemarin WIB) & hari WIB (hari ini).
        $this->makePrediction($region, self::UTC_TODAY, 'rendah', 12.5);
        $this->makePrediction($region, self::WIB_TODAY, 'sangat_tinggi', 91.5);

        $this->getJson('/api/public/map?regency='.urlencode($regency))
            ->assertOk()
            // Peta memilih prediksi terdekat >= hari ini: harus yang WIB.
            ->assertJsonPath('data.regions.features.0.properties.risk_class', 'sangat_tinggi')
            ->assertJsonPath('data.regions.features.0.properties.risk_probability', 91.5);
    }

    public function test_high_risk_notification_targets_the_same_day_as_the_map(): void
    {
        // Command memakai tanggal default (tanpa --date) — inilah sisi yang
        // dulu WIB sementara peta/dashboard UTC. Dipanggil lewat Artisan::call
        // (bukan $this->artisan()) karena ekspektasi PendingCommand butuh
        // Mockery, yang bukan dependensi proyek ini.
        self::assertSame(0, Artisan::call('predictions:notify-high-risk'));
        self::assertStringContainsString(self::WIB_TODAY, Artisan::output());
    }

    public function test_province_forecast_window_starts_on_the_wib_day(): void
    {
        $regency = 'Kabupaten Prakiraan '.Str::upper(Str::random(6));
        $region = $this->insertRegion($regency);
        $this->makePrediction($region, self::UTC_TODAY, 'rendah', 10.5);
        $this->makePrediction($region, self::WIB_TODAY, 'tinggi', 77.5);

        $dates = collect($this->getJson('/api/public/province/forecast?regency='.urlencode($regency))
            ->assertOk()
            ->json('data'))
            ->map(fn (array $row): string => substr((string) $row['prediction_date'], 0, 10))
            ->all();

        self::assertNotEmpty($dates, 'Prakiraan provinsi tidak mengembalikan tanggal apa pun.');
        self::assertContains(self::WIB_TODAY, $dates);
        self::assertNotContains(self::UTC_TODAY, $dates, 'Jendela prakiraan masih mulai dari hari UTC.');
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
            'source_reference' => 'pre-dawn-anchor-test',
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
             VALUES (?, 'Lampung', ?, 'Kecamatan Subuh', 'Kelurahan Subuh', {$geometrySql}, 1500, true, 'FeatureTest', 'pre-dawn-anchor-test', 'demo', now(), now())",
            [$id, $regency, $geometry],
        );

        return Region::findOrFail($id);
    }
}
