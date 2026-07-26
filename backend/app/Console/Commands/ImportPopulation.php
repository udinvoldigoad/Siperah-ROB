<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Impor populasi resmi per desa/kelurahan (mis. tabel "Jumlah Penduduk menurut
 * Desa/Kelurahan" dari publikasi BPS Kecamatan Dalam Angka) ke regions.
 *
 * Prinsip: TIDAK ada angka tanpa sumber. --source dan --reference wajib diisi
 * dan tercatat per baris di kolom population_source/population_source_reference,
 * plus jejak run di data_import_runs. Baris yang tidak cocok dengan region
 * mana pun dilaporkan, tidak ditebak.
 */
final class ImportPopulation extends Command
{
    protected $signature = 'data:import-population
        {file : Path CSV resmi dengan kolom kabupaten, kecamatan, desa/kelurahan, jumlah penduduk}
        {--source= : Nama sumber resmi, mis. "BPS - Kecamatan Panjang Dalam Angka 2025"}
        {--reference= : URL/nomor publikasi sumber (wajib, untuk audit)}
        {--delimiter=auto : Pemisah kolom CSV (auto|,|;)}
        {--dry-run : Cocokkan & laporkan tanpa menulis ke database}';

    protected $description = 'Impor populasi per desa/kelurahan dari file resmi (BPS) dengan provenance eksplisit';

    /** Alias header yang diterima (dinormalisasi lowercase tanpa spasi). */
    private const HEADER_ALIASES = [
        'regency' => ['kabupaten', 'kabupaten_kota', 'kabupatenkota', 'kab_kota', 'regency'],
        'district' => ['kecamatan', 'district', 'kec'],
        'village' => ['desa', 'kelurahan', 'desa_kelurahan', 'desakelurahan', 'village', 'nama_desa'],
        'population' => ['jumlah_penduduk', 'penduduk', 'population', 'jumlah', 'total_penduduk'],
    ];

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        $source = trim((string) $this->option('source'));
        $reference = trim((string) $this->option('reference'));
        $dryRun = (bool) $this->option('dry-run');

        if ($source === '' || $reference === '') {
            $this->error('Opsi --source dan --reference wajib diisi — impor tanpa provenance ditolak.');
            return self::FAILURE;
        }
        if (!is_file($path)) {
            $this->error("File tidak ditemukan: {$path}");
            return self::FAILURE;
        }

        $rows = $this->readCsv($path);
        if ($rows === null) {
            return self::FAILURE;
        }
        $this->info(sprintf('%d baris terbaca dari %s', count($rows), basename($path)));

        $regions = DB::table('regions')
            ->select(['id', 'regency', 'district', 'village'])
            ->get()
            ->map(function ($region) {
                $region->key_full = $this->normalizeName($region->regency).'|'
                    .$this->normalizeName($region->district).'|'
                    .$this->normalizeName($region->village);
                $region->key_short = $this->normalizeName($region->regency).'|'
                    .$this->normalizeName($region->village);
                return $region;
            });
        $byFull = $regions->groupBy('key_full');
        $byShort = $regions->groupBy('key_short');

        $runId = null;
        if (!$dryRun) {
            $runId = (string) Str::uuid();
            DB::table('data_import_runs')->insert([
                'id' => $runId,
                'source' => $source,
                'dataset_type' => 'population',
                'status' => 'running',
                'source_reference' => $reference,
                'started_at' => now(),
            ]);
        }

        $matched = 0;
        $ambiguous = [];
        $unmatched = [];
        foreach ($rows as $row) {
            $keyFull = $this->normalizeName($row['regency']).'|'
                .$this->normalizeName($row['district']).'|'
                .$this->normalizeName($row['village']);
            $keyShort = $this->normalizeName($row['regency']).'|'.$this->normalizeName($row['village']);

            $candidates = $byFull->get($keyFull) ?? collect();
            if ($candidates->isEmpty() && $this->normalizeName($row['district']) === '') {
                $candidates = $byShort->get($keyShort) ?? collect();
            }

            if ($candidates->isEmpty()) {
                $unmatched[] = $row;
                continue;
            }
            if ($candidates->count() > 1) {
                $ambiguous[] = $row;
                continue;
            }

            $matched++;
            if (!$dryRun) {
                DB::table('regions')->where('id', $candidates->first()->id)->update([
                    'population' => $row['population'],
                    'population_source' => $source,
                    'population_source_reference' => $reference,
                    'population_provenance_status' => 'official',
                    'updated_at' => now(),
                ]);
            }
        }

        if ($runId) {
            DB::table('data_import_runs')->where('id', $runId)->update([
                'status' => 'completed',
                'fetched_count' => count($rows),
                'valid_count' => $matched,
                'invalid_count' => count($unmatched) + count($ambiguous),
                'inserted_count' => $matched,
                'error_summary' => ($unmatched || $ambiguous) ? json_encode([
                    'unmatched' => array_slice(array_map(
                        fn (array $row) => "{$row['regency']}/{$row['district']}/{$row['village']}", $unmatched), 0, 50),
                    'ambiguous' => array_slice(array_map(
                        fn (array $row) => "{$row['regency']}/{$row['district']}/{$row['village']}", $ambiguous), 0, 50),
                ]) : null,
                'completed_at' => now(),
            ]);
        }

        $mode = $dryRun ? 'DRY-RUN (tidak menulis)' : 'ditulis ke database';
        $this->info(sprintf('Cocok: %d baris %s. Tak cocok: %d. Ambigu: %d.',
            $matched, $mode, count($unmatched), count($ambiguous)));
        foreach (array_slice($unmatched, 0, 10) as $row) {
            $this->line("  ? tak cocok: {$row['regency']} / {$row['district']} / {$row['village']}");
        }
        foreach (array_slice($ambiguous, 0, 10) as $row) {
            $this->line("  ! ambigu   : {$row['regency']} / {$row['district']} / {$row['village']}");
        }

        return self::SUCCESS;
    }

    /** @return list<array{regency: string, district: string, village: string, population: int}>|null */
    private function readCsv(string $path): ?array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            $this->error("Tidak bisa membuka file: {$path}");
            return null;
        }

        $firstLine = fgets($handle) ?: '';
        rewind($handle);
        $delimiter = (string) $this->option('delimiter');
        if ($delimiter === 'auto') {
            $delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';
        }

        $header = fgetcsv($handle, 0, $delimiter);
        if ($header === false) {
            fclose($handle);
            $this->error('File kosong atau header tidak terbaca.');
            return null;
        }

        $columns = [];
        foreach ($header as $index => $name) {
            $normalized = $this->normalizeHeader((string) $name);
            foreach (self::HEADER_ALIASES as $field => $aliases) {
                if (in_array($normalized, $aliases, true)) {
                    $columns[$field] ??= $index;
                }
            }
        }
        $missing = array_diff(array_keys(self::HEADER_ALIASES), array_keys($columns));
        // Kecamatan opsional (fallback pencocokan kabupaten+desa), sisanya wajib.
        $missing = array_diff($missing, ['district']);
        if ($missing !== []) {
            fclose($handle);
            $this->error('Kolom wajib tidak ditemukan di header: '.implode(', ', $missing)
                .'. Header terbaca: '.implode(' | ', $header));
            return null;
        }

        $rows = [];
        $lineNo = 1;
        while (($line = fgetcsv($handle, 0, $delimiter)) !== false) {
            $lineNo++;
            $population = preg_replace('/[^\d]/', '', (string) ($line[$columns['population']] ?? ''));
            if ($population === '' || (int) $population <= 0) {
                $this->warn("  baris {$lineNo}: populasi kosong/nol — dilewati.");
                continue;
            }
            $rows[] = [
                'regency' => trim((string) ($line[$columns['regency']] ?? '')),
                'district' => isset($columns['district']) ? trim((string) ($line[$columns['district']] ?? '')) : '',
                'village' => trim((string) ($line[$columns['village']] ?? '')),
                'population' => (int) $population,
            ];
        }
        fclose($handle);

        return $rows;
    }

    private function normalizeHeader(string $name): string
    {
        $name = mb_strtolower(trim($name));
        return preg_replace('/[^a-z0-9]+/', '_', $name) ?? $name;
    }

    private function normalizeName(string $name): string
    {
        $name = mb_strtolower(trim($name));
        $name = preg_replace('/^(kabupaten|kota|kab\.?)\s+/i', '', $name) ?? $name;
        return preg_replace('/\s+/', ' ', $name) ?? $name;
    }
}
