<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

final class FetchTidalSeaLevel extends Command
{
    protected $signature = 'data:fetch-tidal-sealevel
        {--days-back=3 : Berapa hari ke belakang yang diambil}
        {--start= : Tanggal awal (Y-m-d), menimpa --days-back}
        {--end= : Tanggal akhir (Y-m-d), default hari ini}
        {--dry-run : Validasi tanpa menulis ke database}';

    protected $description = 'Ambil tinggi muka laut per jam (Open-Meteo Marine, model pasut FES) ke tidal_data dengan validasi kualitas';

    private const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
    private const CHUNK_DAYS = 180;
    /** Tinggi muka laut wajar untuk perairan Lampung; di luar ini ditolak sebagai outlier. */
    private const MAX_ABS_HEIGHT_M = 3.0;

    /**
     * Titik laut per stasiun — WAJIB sinkron dengan STATIONS "marine" di
     * ml-api/files/data_fetcher.py agar fitur pasut ML memakai lokasi yang sama.
     */
    private const STATIONS = [
        ['code' => 'bandar_lampung', 'name' => 'Kota Bandar Lampung (Teluk Lampung)', 'lat' => -5.5500, 'lon' => 105.3200],
        ['code' => 'lampung_selatan', 'name' => 'Lampung Selatan (Kalianda, Selat Sunda)', 'lat' => -5.8000, 'lon' => 105.6200],
        ['code' => 'pesawaran', 'name' => 'Pesawaran (Teluk Lampung)', 'lat' => -5.6500, 'lon' => 105.1200],
        ['code' => 'tanggamus', 'name' => 'Tanggamus (Kota Agung, Teluk Semaka)', 'lat' => -5.7500, 'lon' => 104.6800],
        ['code' => 'pesisir_barat', 'name' => 'Pesisir Barat (Krui, Samudra Hindia)', 'lat' => -5.2500, 'lon' => 103.8500],
        ['code' => 'lampung_timur', 'name' => 'Lampung Timur (Labuhan Maringgai, Laut Jawa)', 'lat' => -5.1200, 'lon' => 105.9500],
        ['code' => 'tulang_bawang', 'name' => 'Tulang Bawang (Kuala Teladas, Laut Jawa)', 'lat' => -4.4500, 'lon' => 105.9500],
        ['code' => 'mesuji', 'name' => 'Mesuji (pesisir timur, Laut Jawa)', 'lat' => -4.0500, 'lon' => 105.9000],
    ];

    public function handle(): int
    {
        $end = $this->option('end') ? new \DateTimeImmutable((string) $this->option('end')) : new \DateTimeImmutable('today');
        $start = $this->option('start')
            ? new \DateTimeImmutable((string) $this->option('start'))
            : $end->modify('-'.max(1, (int) $this->option('days-back')).' days');
        $dryRun = (bool) $this->option('dry-run');

        $this->info(sprintf('Rentang %s s.d. %s (%s)', $start->format('Y-m-d'), $end->format('Y-m-d'), $dryRun ? 'dry-run' : 'tulis'));

        $runId = null;
        if (!$dryRun) {
            $runId = (string) Str::uuid();
            DB::table('data_import_runs')->insert([
                'id' => $runId,
                'source' => 'Open-Meteo Marine',
                'dataset_type' => 'tidal_data',
                'status' => 'running',
                'source_reference' => self::MARINE_URL,
                'started_at' => now(),
            ]);
        }

        $totals = ['fetched' => 0, 'valid' => 0, 'null' => 0, 'outlier' => 0, 'written' => 0];
        try {
            foreach (self::STATIONS as $station) {
                $stats = $this->fetchStation($station, $start, $end, $dryRun);
                foreach ($stats as $key => $value) {
                    $totals[$key] += $value;
                }
                $this->line(sprintf(
                    '  %-16s fetched=%-6d valid=%-6d null=%-4d outlier=%-3d written=%d',
                    $station['code'], $stats['fetched'], $stats['valid'], $stats['null'], $stats['outlier'], $stats['written'],
                ));
            }
        } catch (\Throwable $exception) {
            if ($runId) {
                DB::table('data_import_runs')->where('id', $runId)->update([
                    'status' => 'failed',
                    'error_summary' => json_encode([$exception->getMessage()]),
                    'completed_at' => now(),
                ]);
            }
            $this->error('Gagal: '.$exception->getMessage());

            return self::FAILURE;
        }

        if ($runId) {
            DB::table('data_import_runs')->where('id', $runId)->update([
                'status' => 'completed',
                'fetched_count' => $totals['fetched'],
                'valid_count' => $totals['valid'],
                'invalid_count' => $totals['null'] + $totals['outlier'],
                'inserted_count' => $totals['written'],
                'completed_at' => now(),
            ]);
        }

        $this->info(sprintf(
            'Selesai: %d titik diambil, %d valid, %d kosong, %d outlier ditolak, %d ditulis.',
            $totals['fetched'], $totals['valid'], $totals['null'], $totals['outlier'], $totals['written'],
        ));

        return self::SUCCESS;
    }

    /** @param array{code: string, name: string, lat: float, lon: float} $station */
    private function fetchStation(array $station, \DateTimeImmutable $start, \DateTimeImmutable $end, bool $dryRun): array
    {
        $stats = ['fetched' => 0, 'valid' => 0, 'null' => 0, 'outlier' => 0, 'written' => 0];
        $stationId = $dryRun ? null : $this->ensureStation($station);

        for ($chunkStart = $start; $chunkStart <= $end; $chunkStart = $chunkStart->modify('+'.self::CHUNK_DAYS.' days')) {
            $chunkEnd = min($chunkStart->modify('+'.(self::CHUNK_DAYS - 1).' days'), $end);

            $response = Http::retry(3, 2000)->timeout(60)->get(self::MARINE_URL, [
                'latitude' => $station['lat'],
                'longitude' => $station['lon'],
                'hourly' => 'sea_level_height_msl',
                'start_date' => $chunkStart->format('Y-m-d'),
                'end_date' => $chunkEnd->format('Y-m-d'),
                'timezone' => 'UTC',
            ])->throw()->json();

            $times = $response['hourly']['time'] ?? [];
            $heights = $response['hourly']['sea_level_height_msl'] ?? [];

            $rows = [];
            foreach ($times as $index => $time) {
                $stats['fetched']++;
                $height = $heights[$index] ?? null;
                if ($height === null || !is_numeric($height)) {
                    $stats['null']++;
                    continue;
                }
                if (abs((float) $height) > self::MAX_ABS_HEIGHT_M) {
                    $stats['outlier']++;
                    continue;
                }
                $stats['valid']++;
                $rows[] = [
                    'id' => (string) Str::uuid(),
                    'station_id' => $stationId,
                    'station_name' => $station['name'],
                    'station_code' => $station['code'],
                    'recorded_at' => $time.':00+00',
                    'tidal_height' => (float) $height,
                    'unit' => 'm',
                    'source' => 'Open-Meteo Marine',
                    'provenance_status' => 'unverified',
                ];
            }

            if (!$dryRun && $rows !== []) {
                foreach (array_chunk($rows, 1000) as $chunk) {
                    DB::table('tidal_data')->upsert(
                        $chunk,
                        ['station_code', 'recorded_at'],
                        ['tidal_height', 'unit', 'source', 'provenance_status', 'station_id', 'station_name'],
                    );
                    $stats['written'] += count($chunk);
                }
            }
        }

        return $stats;
    }

    /** @param array{code: string, name: string, lat: float, lon: float} $station */
    private function ensureStation(array $station): string
    {
        $existing = DB::table('tidal_stations')->where('code', $station['code'])->first();
        if ($existing) {
            return $existing->id;
        }

        $id = (string) Str::uuid();
        DB::table('tidal_stations')->insert([
            'id' => $id,
            'code' => $station['code'],
            'name' => $station['name'],
            'latitude' => $station['lat'],
            'longitude' => $station['lon'],
            'default_datum' => 'MSL',
            'timezone' => 'Asia/Jakarta',
            'source' => 'Open-Meteo Marine (model pasut FES)',
            'source_url' => self::MARINE_URL,
            'provenance_status' => 'unverified',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }
}
