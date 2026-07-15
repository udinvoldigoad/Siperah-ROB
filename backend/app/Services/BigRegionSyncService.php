<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

final class BigRegionSyncService
{
    public const SOURCE_URL = 'https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KelDesa_10K/MapServer/0';
    private const PAGE_SIZE = 100;

    /** @return array{reported: int, fetched: int, valid: int, invalid: int, inserted: int, updated: int, errors: list<string>} */
    public function sync(string $province, bool $dryRun = false, ?callable $progress = null): array
    {
        $province = trim($province);
        if ($province === '') {
            throw new RuntimeException('Nama provinsi wajib diisi.');
        }

        $runId = $dryRun ? null : (string) Str::uuid();
        if ($runId) {
            DB::table('data_import_runs')->insert([
                'id' => $runId,
                'source' => 'Badan Informasi Geospasial',
                'dataset_type' => 'administrative_regions',
                'status' => 'running',
                'source_reference' => self::SOURCE_URL,
                'started_at' => now(),
            ]);
        }

        try {
            return $this->performSync($province, $dryRun, $runId, $progress);
        } catch (Throwable $exception) {
            $fallbackResult = $this->attemptFallback($province, $dryRun, $runId);
            if ($fallbackResult !== null) {
                return $fallbackResult;
            }

            if ($runId) {
                DB::table('data_import_runs')->where('id', $runId)->update([
                    'status' => 'failed',
                    'error_summary' => json_encode([$exception->getMessage()]),
                    'completed_at' => now(),
                ]);
            }
            throw $exception;
        }
    }

    private function performSync(string $province, bool $dryRun, ?string $runId, ?callable $progress): array
    {
        $http = $this->http();
        $reported = $this->fetchCount($http, $province);
        $stats = [
            'reported' => $reported,
            'fetched' => 0,
            'valid' => 0,
            'invalid' => 0,
            'inserted' => 0,
            'updated' => 0,
            'errors' => [],
        ];

        for ($offset = 0; $offset < $reported; $offset += self::PAGE_SIZE) {
            $features = $this->fetchPage($http, $province, $offset);
            if ($features === []) {
                throw new RuntimeException("BIG mengembalikan halaman kosong pada offset {$offset}.");
            }

            $validFeatures = [];
            foreach ($features as $index => $feature) {
                $stats['fetched']++;
                try {
                    $validFeatures[] = $this->normalizeFeature($feature);
                    $stats['valid']++;
                } catch (RuntimeException $exception) {
                    $stats['invalid']++;
                    if (count($stats['errors']) < 20) {
                        $stats['errors'][] = 'Offset '.($offset + $index).': '.$exception->getMessage();
                    }
                }
            }

            if ($runId && $validFeatures !== []) {
                $staged = array_map(fn (array $feature) => [
                    'id' => (string) Str::uuid(),
                    'run_id' => $runId,
                    'region_code' => $feature['code'],
                    'province' => $feature['province'],
                    'regency' => $feature['regency'],
                    'district' => $feature['district'],
                    'village' => $feature['village'],
                    'geometry_geojson' => $feature['geometry'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ], $validFeatures);
                DB::table('region_import_staging')->upsert(
                    $staged,
                    ['run_id', 'region_code'],
                    ['province', 'regency', 'district', 'village', 'geometry_geojson', 'updated_at'],
                );
            }

            if ($progress) {
                $progress($stats['fetched'], $reported);
            }
        }

        if ($stats['fetched'] !== $reported) {
            throw new RuntimeException("Jumlah fitur tidak cocok: BIG={$reported}, diterima={$stats['fetched']}.");
        }

        if ($runId) {
            if ($stats['invalid'] > 0) {
                DB::table('data_import_runs')->where('id', $runId)->update([
                    'status' => 'failed',
                    'fetched_count' => $stats['fetched'],
                    'valid_count' => $stats['valid'],
                    'invalid_count' => $stats['invalid'],
                    'error_summary' => json_encode($stats['errors']),
                    'completed_at' => now(),
                ]);
                return $stats;
            }

            DB::transaction(function () use ($runId, $province, &$stats): void {
                $backupData = [];
                foreach (DB::table('region_import_staging')->where('run_id', $runId)->orderBy('region_code')->cursor() as $row) {
                    $this->persist([
                        'code' => $row->region_code,
                        'province' => $row->province,
                        'regency' => $row->regency,
                        'district' => $row->district,
                        'village' => $row->village,
                        'geometry' => is_string($row->geometry_geojson)
                            ? $row->geometry_geojson
                            : json_encode($row->geometry_geojson, JSON_THROW_ON_ERROR),
                    ], $stats);
                    $backupData[] = (array) $row;
                }

                $backupPath = storage_path('app/geo/big_sync_'.Str::slug($province).'_backup.json');
                if (!file_exists(dirname($backupPath))) {
                    mkdir(dirname($backupPath), 0755, true);
                }
                file_put_contents($backupPath, json_encode($backupData, JSON_THROW_ON_ERROR));

                DB::table('data_import_runs')->where('id', $runId)->update([
                    'status' => 'completed',
                    'fetched_count' => $stats['fetched'],
                    'valid_count' => $stats['valid'],
                    'invalid_count' => 0,
                    'inserted_count' => $stats['inserted'],
                    'updated_count' => $stats['updated'],
                    'completed_at' => now(),
                ]);
                DB::table('region_import_staging')->where('run_id', $runId)->delete();
            });
        }

        return $stats;
    }

    private function attemptFallback(string $province, bool $dryRun, ?string $runId): ?array
    {
        $backupPath = storage_path('app/geo/big_sync_'.Str::slug($province).'_backup.json');
        if (!file_exists($backupPath)) {
            return null;
        }

        $backupData = json_decode(file_get_contents($backupPath), true, 512, JSON_THROW_ON_ERROR);
        if (!$backupData) {
            return null;
        }

        $stats = [
            'reported' => count($backupData),
            'fetched' => count($backupData),
            'valid' => count($backupData),
            'invalid' => 0,
            'inserted' => 0,
            'updated' => 0,
            'errors' => ['Peringatan: Menggunakan data fallback lokal karena BIG gagal.'],
        ];

        if ($runId) {
            DB::transaction(function () use ($runId, $backupData, &$stats): void {
                foreach ($backupData as $row) {
                    $this->persist([
                        'code' => $row['region_code'],
                        'province' => $row['province'],
                        'regency' => $row['regency'],
                        'district' => $row['district'],
                        'village' => $row['village'],
                        'geometry' => is_string($row['geometry_geojson'])
                            ? $row['geometry_geojson']
                            : json_encode($row['geometry_geojson'], JSON_THROW_ON_ERROR),
                    ], $stats);
                }

                DB::table('data_import_runs')->where('id', $runId)->update([
                    'status' => 'completed',
                    'fetched_count' => $stats['fetched'],
                    'valid_count' => $stats['valid'],
                    'invalid_count' => 0,
                    'inserted_count' => $stats['inserted'],
                    'updated_count' => $stats['updated'],
                    'completed_at' => now(),
                    'error_summary' => json_encode($stats['errors']),
                ]);
            });
        }

        return $stats;
    }

    private function http(): PendingRequest
    {
        return Http::acceptJson()
            ->withUserAgent('SIPERAH-RoB/1.0 (BIG region synchronization)')
            ->connectTimeout(15)
            ->timeout(90)
            ->retry(3, 1000, throw: false);
    }

    private function fetchCount(PendingRequest $http, string $province): int
    {
        $response = $http->get(self::SOURCE_URL.'/query', [
            'where' => $this->whereProvince($province),
            'returnCountOnly' => 'true',
            'f' => 'json',
        ]);

        if (!$response->successful() || !is_numeric($response->json('count'))) {
            throw new RuntimeException('Gagal mengambil jumlah wilayah dari BIG (HTTP '.$response->status().').');
        }

        return (int) $response->json('count');
    }

    /** @return list<array<string, mixed>> */
    private function fetchPage(PendingRequest $http, string $province, int $offset): array
    {
        $response = $http->get(self::SOURCE_URL.'/query', [
            'where' => $this->whereProvince($province),
            'outFields' => 'OBJECTID,KDEPUM,KDEBPS,WADMKD,WADMKC,WADMKK,WADMPR,TIPADM',
            'returnGeometry' => 'true',
            'outSR' => '4326',
            'orderByFields' => 'OBJECTID ASC',
            'resultOffset' => $offset,
            'resultRecordCount' => self::PAGE_SIZE,
            'f' => 'geojson',
        ]);

        if (!$response->successful() || !is_array($response->json('features'))) {
            throw new RuntimeException("Gagal mengambil data BIG pada offset {$offset} (HTTP {$response->status()}).");
        }

        return $response->json('features');
    }

    private function whereProvince(string $province): string
    {
        return "WADMPR='".str_replace("'", "''", $province)."'";
    }

    /** @return array{code: string, village: string, district: string, regency: string, province: string, geometry: string} */
    private function normalizeFeature(array $feature): array
    {
        $properties = $feature['properties'] ?? null;
        $geometry = $feature['geometry'] ?? null;
        if (!is_array($properties) || !is_array($geometry)) {
            throw new RuntimeException('Feature tidak memiliki properties/geometry.');
        }

        $type = $geometry['type'] ?? null;
        if (!in_array($type, ['Polygon', 'MultiPolygon'], true)) {
            throw new RuntimeException("Tipe geometry {$type} tidak didukung.");
        }

        $mapped = [
            'code' => trim((string) ($properties['KDEPUM'] ?? '')),
            'village' => trim((string) ($properties['WADMKD'] ?? '')),
            'district' => trim((string) ($properties['WADMKC'] ?? '')),
            'regency' => trim((string) ($properties['WADMKK'] ?? '')),
            'province' => trim((string) ($properties['WADMPR'] ?? '')),
        ];
        foreach ($mapped as $field => $value) {
            if ($value === '') {
                throw new RuntimeException("Field {$field} kosong.");
            }
        }

        $encoded = json_encode($geometry, JSON_THROW_ON_ERROR);
        return $mapped + ['geometry' => $encoded];
    }

    /** @param array<string, mixed> $feature @param array<string, mixed> $stats */
    private function persist(array $feature, array &$stats): void
    {
        $existing = DB::table('regions')->where('region_code', $feature['code'])->first();
        if (!$existing) {
            $existing = DB::table('regions')
                ->whereRaw('LOWER(province) = LOWER(?)', [$feature['province']])
                ->whereRaw('LOWER(regency) = LOWER(?)', [$feature['regency']])
                ->whereRaw('LOWER(district) = LOWER(?)', [$feature['district']])
                ->whereRaw('LOWER(village) = LOWER(?)', [$feature['village']])
                ->first();
        }

        $id = $existing?->id ?? (string) Str::uuid();
        $postgis = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        if (!$postgis) {
            $values = [
                'region_code' => $feature['code'], 'province' => $feature['province'],
                'regency' => $feature['regency'], 'district' => $feature['district'], 'village' => $feature['village'],
                'geometry' => $feature['geometry'], 'data_source' => 'Badan Informasi Geospasial',
                'source_reference' => self::SOURCE_URL, 'provenance_status' => 'official',
                'boundary_status' => 'reference', 'source_edition' => '2020-10',
                'source_synced_at' => now(), 'updated_at' => now(),
            ];
            if ($existing) {
                DB::table('regions')->where('id', $id)->update($values);
                $stats['updated']++;
            } else {
                DB::table('regions')->insert($values + [
                    'id' => $id, 'population' => null, 'coastal_flag' => false, 'created_at' => now(),
                ]);
                $stats['inserted']++;
            }
            return;
        }

        $geometrySql = "ST_Multi(ST_Force2D(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)), 3)))";
        $values = [
            $feature['geometry'], $feature['code'], $feature['province'], $feature['regency'],
            $feature['district'], $feature['village'], self::SOURCE_URL, now(), $id,
        ];

        if ($existing) {
            DB::update(
                "UPDATE regions SET geometry={$geometrySql}, region_code=?, province=?, regency=?, district=?, village=?,
                 data_source='Badan Informasi Geospasial', source_reference=?, provenance_status='official',
                 boundary_status='reference', source_edition='2020-10', source_synced_at=?, updated_at=now()
                 WHERE id=?",
                $values,
            );
            $stats['updated']++;
            return;
        }

        DB::insert(
            "INSERT INTO regions (id, region_code, province, regency, district, village, geometry, population,
             coastal_flag, data_source, source_reference, provenance_status, boundary_status, source_edition,
             source_synced_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, {$geometrySql}, NULL, false, 'Badan Informasi Geospasial', ?,
             'official', 'reference', '2020-10', ?, now(), now())",
            [
                $id, $feature['code'], $feature['province'], $feature['regency'], $feature['district'],
                $feature['village'], $feature['geometry'], self::SOURCE_URL, now(),
            ],
        );
        $stats['inserted']++;
    }
}
