<?php

namespace Tests\Feature;

use App\Services\BigRegionSyncService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Pipeline import data: tulis-nyata CSV pasut (idempotent + label wajib),
 * sinkron wilayah BIG mode tulis (upsert + catatan data_import_runs),
 * command ml:predict (sukses/gagal mengikuti exit code pipeline — interpreter
 * di-stub dengan PHP_BINARY agar tak butuh Python), dan registrasi scheduler
 * harian. Validasi dry-run dicakup unit test BigRegionSync/TidalCsvImporter.
 */
final class DataImportPipelineTest extends TestCase
{
    use DatabaseTransactions;

    /** @var list<string> */
    private array $cleanupPaths = [];

    protected function tearDown(): void
    {
        foreach ($this->cleanupPaths as $path) {
            if (is_dir($path)) {
                array_map('unlink', glob($path.DIRECTORY_SEPARATOR.'*') ?: []);
                rmdir($path);
            } elseif (is_file($path)) {
                unlink($path);
            }
        }
        parent::tearDown();
    }

    public function test_tidal_csv_import_writes_station_and_rows_idempotently(): void
    {
        $csv = $this->tempFile(
            "Date,EST,MSL,LAT\n2026-07-12 00:00:00,2.79,0.36,1.04\n2026-07-12 01:00:00,2.60,0.20,0.88\n",
        );
        $options = [
            'file' => $csv,
            '--format' => 'chart',
            '--station-code' => 'UJI-IMPORT',
            '--station-name' => 'Stasiun Uji Import',
            '--source' => 'Fixture Import Test',
            '--datum' => 'MSL',
            '--provenance' => 'demo',
        ];

        $this->assertSame(0, Artisan::call('data:import-tidal', $options));
        $this->assertDatabaseHas('tidal_stations', ['code' => 'UJI-IMPORT', 'name' => 'Stasiun Uji Import']);
        $this->assertSame(2, DB::table('tidal_data')->where('station_code', 'UJI-IMPORT')->count());

        // Import ulang file sama tidak menggandakan baris (upsert by station+waktu).
        $this->assertSame(0, Artisan::call('data:import-tidal', $options));
        $this->assertSame(2, DB::table('tidal_data')->where('station_code', 'UJI-IMPORT')->count());
    }

    public function test_tidal_import_refuses_unlabeled_data_and_broken_csv(): void
    {
        $csv = $this->tempFile("Date,EST,MSL,LAT\n2026-07-12 00:00:00,2.79,0.36,1.04\n");

        // Tanpa --station-code: gagal sebelum menyentuh importer.
        $this->assertSame(1, Artisan::call('data:import-tidal', [
            'file' => $csv,
            '--station-name' => 'Stasiun Tanpa Kode',
            '--source' => 'Fixture',
        ]));

        // CSV tanpa kolom datum yang diminta: importer melempar, command exit 1.
        $broken = $this->tempFile("Tanggal,Nilai\n2026-07-12,1.0\n");
        $this->assertSame(1, Artisan::call('data:import-tidal', [
            'file' => $broken,
            '--station-code' => 'UJI-RUSAK',
            '--station-name' => 'Stasiun Rusak',
            '--source' => 'Fixture',
        ]));
        $this->assertDatabaseMissing('tidal_stations', ['code' => 'UJI-RUSAK']);
    }

    public function test_big_region_sync_write_mode_upserts_region_and_records_run(): void
    {
        $regionCode = '18.99.99.2999';
        $feature = [
            'type' => 'Feature',
            'geometry' => [
                'type' => 'Polygon',
                'coordinates' => [[[105.0, -5.0], [105.1, -5.0], [105.1, -5.1], [105.0, -5.0]]],
            ],
            'properties' => [
                'KDEPUM' => $regionCode,
                'WADMKD' => 'Desa Sinkron Uji',
                'WADMKC' => 'Kecamatan Sinkron Uji',
                'WADMKK' => 'Kabupaten Sinkron Uji',
                'WADMPR' => 'Lampung Uji',
            ],
        ];
        Http::fakeSequence()
            ->push(['count' => 1])
            ->push(['type' => 'FeatureCollection', 'features' => [$feature]])
            ->push(['count' => 1])
            ->push(['type' => 'FeatureCollection', 'features' => [$feature]]);
        // Mode tulis menyimpan file backup per provinsi — pakai nama provinsi
        // uji agar tidak menimpa backup Lampung sungguhan, lalu dibersihkan.
        $this->cleanupPaths[] = storage_path('app/geo/big_sync_lampung-uji_backup.json');

        $first = (new BigRegionSyncService())->sync('Lampung Uji', false);
        $this->assertSame(1, $first['valid']);
        $this->assertSame(1, $first['inserted']);
        $this->assertSame(1, DB::table('regions')->where('region_code', $regionCode)->count());
        $this->assertDatabaseHas('data_import_runs', [
            'dataset_type' => 'administrative_regions',
            'status' => 'completed',
            'valid_count' => 1,
        ]);

        // Sinkron ulang snapshot sama: update, bukan duplikat.
        $second = (new BigRegionSyncService())->sync('Lampung Uji', false);
        $this->assertSame(0, $second['inserted']);
        $this->assertSame(1, $second['updated']);
        $this->assertSame(1, DB::table('regions')->where('region_code', $regionCode)->count());
    }

    public function test_ml_predict_follows_pipeline_exit_code(): void
    {
        $stubDir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'ml-stub-'.uniqid();
        mkdir($stubDir);
        $this->cleanupPaths[] = $stubDir;
        config(['services.ml_api.path' => $stubDir, 'services.ml_api.python' => PHP_BINARY]);

        file_put_contents($stubDir.DIRECTORY_SEPARATOR.'main.py', "<?php fwrite(STDOUT, 'pipeline-stub-ok'); exit(0);");
        $this->assertSame(0, Artisan::call('ml:predict', ['--timeout' => 60]));
        $output = Artisan::output();
        $this->assertStringContainsString('pipeline-stub-ok', $output);
        $this->assertStringContainsString('Pipeline ML selesai.', $output);

        file_put_contents($stubDir.DIRECTORY_SEPARATOR.'main.py', "<?php exit(5);");
        $this->assertSame(1, Artisan::call('ml:predict', ['--timeout' => 60]));
        $this->assertStringContainsString('Pipeline ML gagal dengan exit code 5', Artisan::output());
    }

    public function test_daily_data_pipeline_commands_are_scheduled(): void
    {
        // Schedule baru terdaftar saat kernel console bootstrap (Artisan::starting),
        // jadi diperiksa lewat output schedule:list, bukan resolve Schedule langsung.
        $this->assertSame(0, Artisan::call('schedule:list'));
        $output = Artisan::output();

        foreach ([
            'data:fetch-tidal-sealevel',
            'data:refresh-operational',
            'ml:predict',
            'predictions:notify-high-risk',
            'audit:prune',
        ] as $expected) {
            $this->assertStringContainsString(
                $expected,
                $output,
                "Command [{$expected}] tidak terdaftar di scheduler.",
            );
        }
    }

    private function tempFile(string $content): string
    {
        $path = tempnam(sys_get_temp_dir(), 'siperah-import-test');
        file_put_contents($path, $content);
        $this->cleanupPaths[] = $path;

        return $path;
    }
}
