<?php

namespace Tests\Feature;

use App\Models\Dataset;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\User;
use App\Support\AppTime;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Jumlah rekaman dataset di portal riset.
 *
 * Angkanya sengaja dihitung dari query data NYATA (bukan kolom `record_count`
 * seeder) supaya selalu cocok dengan isi unduhan — konsekuensinya satu COUNT
 * per dataset. Tiap COUNT itu join predictions×regions dengan REGEXP pada nama
 * kabupaten, jadi jauh dari murah, dan dulu dijalankan ulang SETIAP kali
 * halaman daftar/statistik dibuka.
 *
 * Test ini mengunci dua hal sekaligus: angkanya tetap benar, DAN hitungannya
 * tak dijalankan ulang untuk request berikutnya.
 */
final class ResearchDatasetCountTest extends TestCase
{
    use DatabaseTransactions;

    public function test_record_count_reflects_real_rows_not_the_seeder_column(): void
    {
        $region = $this->insertRegion('Kabupaten Hitung '.Str::upper(Str::random(5)));
        $today = AppTime::today();
        for ($i = 0; $i < 3; $i++) {
            $this->makePrediction($region, $today->addDays($i)->toDateString());
        }

        // record_count seeder sengaja diisi salah (999) — respons harus memakai
        // hitungan nyata (3), bukan angka statis itu.
        $dataset = $this->makeDataset($region->regency, recordCount: 999);

        $row = collect(
            $this->actingAs($this->makeUser('peneliti'))
                ->getJson('/api/research/datasets?per_page=100')
                ->assertOk()
                ->json('data'),
        )->firstWhere('id', $dataset->id);

        self::assertNotNull($row, 'Dataset uji tak ada di respons.');
        self::assertSame(3, $row['record_count']);
    }

    public function test_repeat_requests_do_not_recount_every_dataset(): void
    {
        $region = $this->insertRegion('Kabupaten Beban '.Str::upper(Str::random(5)));
        $this->makePrediction($region, AppTime::todayString());
        for ($i = 0; $i < 5; $i++) {
            $this->makeDataset($region->regency);
        }

        $researcher = $this->makeUser('peneliti');

        // Panggilan pertama (cache dingin) boleh menghitung.
        $this->actingAs($researcher)->getJson('/api/research/datasets?per_page=100')->assertOk();

        // Panggilan kedua tak boleh menghitung ulang satu pun dataset.
        $this->app['auth']->forgetGuards();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($researcher)->getJson('/api/research/datasets?per_page=100')->assertOk();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $counts = array_filter(
            $queries,
            fn (array $q): bool => str_contains(mb_strtolower($q['query']), 'count(*)')
                && str_contains(mb_strtolower($q['query']), 'predictions'),
        );

        self::assertCount(
            0,
            $counts,
            'COUNT per dataset masih dijalankan ulang: '.count($counts).' query — cache tak bekerja.',
        );
    }

    public function test_stats_total_records_is_served_from_cache_on_repeat(): void
    {
        $region = $this->insertRegion('Kabupaten Statistik '.Str::upper(Str::random(5)));
        $this->makePrediction($region, AppTime::todayString());
        for ($i = 0; $i < 4; $i++) {
            $this->makeDataset($region->regency);
        }

        $researcher = $this->makeUser('peneliti');
        $first = $this->actingAs($researcher)->getJson('/api/research/stats')->assertOk()->json('data.total_records');

        $this->app['auth']->forgetGuards();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $second = $this->actingAs($researcher)->getJson('/api/research/stats')->assertOk()->json('data.total_records');
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        self::assertSame($first, $second, 'Nilai dari cache harus sama dengan hitungan pertama.');
        self::assertCount(
            0,
            array_filter(
                $queries,
                fn (array $q): bool => str_contains(mb_strtolower($q['query']), 'count(*)')
                    && str_contains(mb_strtolower($q['query']), 'predictions'),
            ),
            'total_records masih menghitung ulang tiap dataset.',
        );
    }

    public function test_changing_dataset_period_invalidates_the_cached_count(): void
    {
        $region = $this->insertRegion('Kabupaten Ubah '.Str::upper(Str::random(5)));
        $today = AppTime::today();
        $this->makePrediction($region, $today->toDateString());
        $this->makePrediction($region, $today->addDays(5)->toDateString());

        $dataset = $this->makeDataset($region->regency);
        $researcher = $this->makeUser('peneliti');

        $countOf = function (string $id) use ($researcher): int {
            $this->app['auth']->forgetGuards();
            return collect(
                $this->actingAs($researcher)->getJson('/api/research/datasets?per_page=100')->json('data'),
            )->firstWhere('id', $id)['record_count'];
        };

        self::assertSame(2, $countOf($dataset->id));

        // Persempit periode sehingga hanya 1 prediksi yang tercakup. Tabel
        // datasets tak punya updated_at, jadi ini menguji bahwa kunci cache
        // memang dibangun dari metadata — bukan dari id saja.
        $dataset->period_end = $today->addDays(2)->toDateString();
        $dataset->save();

        self::assertSame(1, $countOf($dataset->id), 'Cache tak ikut berubah saat periode dataset diubah.');
    }

    private function makeDataset(?string $regency, int $recordCount = 0): Dataset
    {
        return Dataset::create([
            'id' => (string) Str::uuid(),
            'name' => 'Dataset Uji '.Str::upper(Str::random(6)),
            'description' => 'Dataset uji hitungan rekaman.',
            'dataset_type' => 'Prediksi Harian',
            'period_start' => AppTime::today()->subDays(30)->toDateString(),
            'period_end' => AppTime::today()->addDays(30)->toDateString(),
            'resolution' => 'harian',
            'record_count' => $recordCount,
            'license' => 'CC-BY-4.0',
            'visibility' => 'peneliti',
            'coverage_regencies' => $regency ? [$regency] : [],
        ]);
    }

    private function makePrediction(Region $region, string $date): Prediction
    {
        return Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => $date,
            'risk_probability' => 55.5,
            'risk_class' => 'sedang',
            'confidence_score' => 85,
            'max_tidal_height' => 1.2,
            'peak_time' => '17:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'dataset-count-test',
            'provenance_status' => 'demo',
        ]);
    }

    private function makeUser(string $role): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Dataset Test',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => $role,
            'status' => 'aktif',
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
             VALUES (?, 'Lampung', ?, 'Kecamatan Hitung', ?, {$geometrySql}, 1500, true, 'FeatureTest', 'dataset-count-test', 'demo', now(), now())",
            [$id, $regency, 'Kelurahan '.Str::upper(Str::random(5)), $geometry],
        );

        return Region::findOrFail($id);
    }
}
