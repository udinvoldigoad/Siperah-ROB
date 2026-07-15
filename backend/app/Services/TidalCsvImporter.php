<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use SplFileObject;

final class TidalCsvImporter
{
    private const CHART_HEADERS = ['Date', 'EST', 'MSL', 'LAT'];
    private const EXTREME_HEADERS = ['Waktu', 'Ketinggian (m)', 'Jenis'];

    /** @return array{rows: int, first_at: string|null, last_at: string|null, minimum: float|null, maximum: float|null} */
    public function import(
        string $path,
        string $format,
        string $stationCode,
        string $stationName,
        string $source,
        string $timezone = 'Asia/Jakarta',
        string $datum = 'MSL',
        bool $dryRun = false,
        ?float $latitude = null,
        ?float $longitude = null,
        ?float $coverageRadiusKm = null,
        ?string $sourceUrl = null,
        string $provenanceStatus = 'unverified',
    ): array {
        if (!is_file($path) || !is_readable($path)) {
            throw new InvalidArgumentException("CSV tidak dapat dibaca: {$path}");
        }

        if (!in_array($format, ['chart', 'extremes'], true)) {
            throw new InvalidArgumentException('Format harus chart atau extremes.');
        }

        if (!in_array($datum, ['EST', 'MSL', 'LAT'], true)) {
            throw new InvalidArgumentException('Datum harus EST, MSL, atau LAT.');
        }

        if (!in_array($provenanceStatus, ['official', 'unverified', 'demo'], true)) {
            throw new InvalidArgumentException('Provenance harus official, unverified, atau demo.');
        }

        if (($latitude === null) !== ($longitude === null)) {
            throw new InvalidArgumentException('Latitude dan longitude stasiun harus diisi berpasangan.');
        }

        $rows = $this->parse($path, $format, $stationCode, $stationName, $source, $timezone, $datum);

        if (!$dryRun) {
            $runId = (string) Str::uuid();
            DB::table('data_import_runs')->insert([
                'id' => $runId,
                'source' => $source,
                'dataset_type' => 'tidal_'.$format,
                'status' => 'running',
                'source_reference' => basename($path),
                'started_at' => now(),
            ]);
            DB::transaction(function () use (
                &$rows, $stationCode, $stationName, $source, $timezone, $datum,
                $latitude, $longitude, $coverageRadiusKm, $sourceUrl, $provenanceStatus, $runId,
            ): void {
                $stationId = DB::table('tidal_stations')->where('code', $stationCode)->value('id');
                $stationValues = [
                        'name' => $stationName,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'coverage_radius_km' => $coverageRadiusKm,
                        'default_datum' => $datum,
                        'timezone' => $timezone,
                        'source' => $source,
                        'source_url' => $sourceUrl,
                        'provenance_status' => $provenanceStatus,
                        'status' => 'active',
                        'updated_at' => now(),
                ];

                if ($stationId) {
                    DB::table('tidal_stations')->where('id', $stationId)->update($stationValues);
                } else {
                    $stationId = (string) Str::uuid();
                    DB::table('tidal_stations')->insert($stationValues + [
                        'id' => $stationId,
                        'code' => $stationCode,
                        'created_at' => now(),
                    ]);
                }

                $rows = array_map(function (array $row) use ($stationId, $provenanceStatus): array {
                    $row['station_id'] = $stationId;
                    $row['provenance_status'] = $provenanceStatus;
                    $row['quality_status'] = 'valid';
                    $row['imported_at'] = now();
                    return $row;
                }, $rows);

                foreach (array_chunk($rows, 500) as $chunk) {
                    DB::table('tidal_data')->upsert(
                        $chunk,
                        ['station_code', 'recorded_at', 'data_type', 'datum'],
                        ['station_id', 'station_name', 'tidal_height', 'unit', 'source', 'event_type', 'timezone', 'source_reference', 'provenance_status', 'quality_status', 'imported_at'],
                    );
                }

                DB::table('data_import_runs')->where('id', $runId)->update([
                    'status' => 'completed',
                    'fetched_count' => count($rows),
                    'valid_count' => count($rows),
                    'inserted_count' => count($rows),
                    'completed_at' => now(),
                ]);
            });
        }

        $heights = array_column($rows, 'tidal_height');

        return [
            'rows' => count($rows),
            'first_at' => $rows[0]['recorded_at'] ?? null,
            'last_at' => $rows[array_key_last($rows)]['recorded_at'] ?? null,
            'minimum' => $heights === [] ? null : min($heights),
            'maximum' => $heights === [] ? null : max($heights),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function parse(
        string $path,
        string $format,
        string $stationCode,
        string $stationName,
        string $source,
        string $timezone,
        string $datum,
    ): array {
        $file = new SplFileObject($path, 'r');
        $file->setCsvControl(',', '"', '');
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);
        $headers = array_map($this->cleanCell(...), $file->fgetcsv());
        $expected = $format === 'chart' ? self::CHART_HEADERS : self::EXTREME_HEADERS;

        if ($headers !== $expected) {
            throw new InvalidArgumentException('Header CSV tidak sesuai. Ditemukan: '.implode(', ', $headers));
        }

        $records = [];
        $seen = [];
        $previous = null;
        $line = 1;

        while (!$file->eof()) {
            $line++;
            $values = $file->fgetcsv();
            if ($values === false || $values === [null]) {
                continue;
            }

            $values = array_map($this->cleanCell(...), $values);
            if (count($values) !== count($expected)) {
                throw new InvalidArgumentException("Baris {$line}: jumlah kolom tidak sesuai.");
            }

            $rawTime = $format === 'chart' ? $values[0] : $values[0];
            $time = CarbonImmutable::createFromFormat('!Y-m-d H:i:s', $rawTime, $timezone);
            if (!$time || $time->format('Y-m-d H:i:s') !== $rawTime) {
                continue;
            }

            if ($previous) {
                if ($time->lessThanOrEqualTo($previous)) {
                    continue; // Lewati duplikasi timestamp atau baris acak
                }
                // Jika interval tidak 10 menit, biarkan saja (missing value/sensor mati adalah hal biasa)
            }
            $previous = $time;

            $heightValue = $format === 'chart'
                ? $values[array_search($datum, self::CHART_HEADERS, true)]
                : $values[1];
            if (!is_numeric($heightValue)) {
                continue; // Lewati jika nilainya kosong atau bukan angka
            }

            $height = (float) $heightValue;
            if ($height < -5 || $height > 5) {
                continue; // Skip outlier ekstrem (di atas/bawah 5 meter dari MSL sangat jarang untuk pasang surut)
            }

            $eventType = null;
            if ($format === 'extremes') {
                $eventType = match (Str::lower($values[2])) {
                    'pasang' => 'high_tide',
                    'surut' => 'low_tide',
                    default => throw new InvalidArgumentException("Baris {$line}: jenis harus Pasang atau Surut."),
                };
            }

            $utcTime = $time->utc()->toIso8601String();
            $naturalKey = implode('|', [$stationCode, $utcTime, $format, $datum]);
            if (isset($seen[$naturalKey])) {
                continue; // Lewati duplikasi identik
            }
            $seen[$naturalKey] = true;

            $records[] = [
                'id' => (string) Str::uuid(),
                'station_name' => $stationName,
                'station_code' => $stationCode,
                'recorded_at' => $utcTime,
                'tidal_height' => $height,
                'unit' => 'm',
                'source' => $source,
                'data_type' => $format === 'chart' ? 'timeseries' : 'extreme',
                'datum' => $datum,
                'event_type' => $eventType,
                'timezone' => $timezone,
                'source_reference' => basename($path),
            ];
        }

        if ($records === []) {
            throw new InvalidArgumentException('CSV tidak memiliki baris data.');
        }

        return $records;
    }

    private function cleanCell(mixed $value): string
    {
        return trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $value));
    }
}
