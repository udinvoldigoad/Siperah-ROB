<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

final class BigCoastlineSyncService
{
    public const SOURCE_URL = 'https://geoservices.big.go.id/rbi/rest/services/GARISPANTAI/GarisPantai_25K/MapServer/0';

    /** @return array{reported:int,fetched:int,valid:int,inserted:int,updated:int} */
    public function sync(array $bbox, bool $dryRun = false, ?callable $progress = null): array
    {
        if (count($bbox) !== 4) {
            throw new RuntimeException('BBox harus berisi xmin,ymin,xmax,ymax.');
        }
        $runId = $dryRun ? null : (string) Str::uuid();
        if ($runId) {
            DB::table('data_import_runs')->insert([
                'id' => $runId, 'source' => 'Badan Informasi Geospasial',
                'dataset_type' => 'coastlines', 'status' => 'running',
                'source_reference' => self::SOURCE_URL, 'started_at' => now(),
            ]);
        }

        $http = $this->http();
        $geometry = implode(',', $bbox);
        $common = [
            'where' => '1=1', 'geometry' => $geometry, 'geometryType' => 'esriGeometryEnvelope',
            'inSR' => '4326', 'spatialRel' => 'esriSpatialRelIntersects',
        ];
        $countResponse = $http->get(self::SOURCE_URL.'/query', $common + ['returnCountOnly' => 'true', 'f' => 'json']);
        $reported = (int) $countResponse->json('count', -1);
        if (!$countResponse->successful() || $reported < 0) {
            throw new RuntimeException('Gagal mengambil jumlah garis pantai BIG.');
        }

        $stats = ['reported' => $reported, 'fetched' => 0, 'valid' => 0, 'inserted' => 0, 'updated' => 0];
        for ($offset = 0; $offset < $reported; $offset += 200) {
            $response = $http->get(self::SOURCE_URL.'/query', $common + [
                'outFields' => 'OBJECTID,TIPGPN,THNSBDATA', 'returnGeometry' => 'true', 'outSR' => '4326',
                'orderByFields' => 'OBJECTID ASC', 'resultOffset' => $offset, 'resultRecordCount' => 200, 'f' => 'geojson',
            ]);
            $features = $response->json('features');
            if (!$response->successful() || !is_array($features) || $features === []) {
                throw new RuntimeException("Gagal mengambil garis pantai BIG pada offset {$offset}.");
            }

            foreach ($features as $feature) {
                $stats['fetched']++;
                $properties = $feature['properties'] ?? [];
                $geometryData = $feature['geometry'] ?? [];
                if (!isset($properties['OBJECTID']) || !in_array($geometryData['type'] ?? null, ['LineString', 'MultiLineString'], true)) {
                    continue;
                }
                $stats['valid']++;
                if (!$dryRun) {
                    $this->persist($properties, json_encode($geometryData, JSON_THROW_ON_ERROR), $stats);
                }
            }
            $progress && $progress($stats['fetched'], $reported);
        }

        if ($stats['fetched'] !== $reported || $stats['valid'] !== $reported) {
            throw new RuntimeException('Jumlah/validitas garis pantai tidak cocok dengan laporan BIG.');
        }
        if ($runId) {
            DB::table('data_import_runs')->where('id', $runId)->update([
                'status' => 'completed', 'fetched_count' => $stats['fetched'], 'valid_count' => $stats['valid'],
                'inserted_count' => $stats['inserted'], 'updated_count' => $stats['updated'], 'completed_at' => now(),
            ]);
        }
        return $stats;
    }

    private function http(): PendingRequest
    {
        return Http::acceptJson()->withUserAgent('SIPERAH-RoB/1.0 (BIG coastline synchronization)')
            ->connectTimeout(15)->timeout(90)->retry(3, 1000, throw: false);
    }

    private function persist(array $properties, string $geometry, array &$stats): void
    {
        $objectId = (int) $properties['OBJECTID'];
        $exists = DB::table('coastlines')->where('source_object_id', $objectId)->exists();
        if (!Schema::hasColumn('coastlines', 'geometry')) {
            DB::table('coastlines')->updateOrInsert(
                ['source_object_id' => $objectId],
                [
                    'id' => $exists ? DB::table('coastlines')->where('source_object_id', $objectId)->value('id') : (string) Str::uuid(),
                    'geometry_geojson' => $geometry,
                    'shoreline_type' => $properties['TIPGPN'] ?? null,
                    'source_year' => $properties['THNSBDATA'] ?? null,
                    'source' => 'Badan Informasi Geospasial',
                    'source_reference' => self::SOURCE_URL,
                    'source_synced_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
            $stats[$exists ? 'updated' : 'inserted']++;
            return;
        }

        $geometrySql = 'ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)))';
        if ($exists) {
            DB::update(
                "UPDATE coastlines SET geometry={$geometrySql}, shoreline_type=?, source_year=?, source_synced_at=now(), updated_at=now() WHERE source_object_id=?",
                [$geometry, $properties['TIPGPN'] ?? null, $properties['THNSBDATA'] ?? null, $objectId],
            );
            $stats['updated']++;
            return;
        }
        DB::insert(
            "INSERT INTO coastlines (id, source_object_id, geometry, shoreline_type, source_year, source, source_reference, source_synced_at)
             VALUES (?, ?, {$geometrySql}, ?, ?, 'Badan Informasi Geospasial', ?, now())",
            [(string) Str::uuid(), $objectId, $geometry, $properties['TIPGPN'] ?? null, $properties['THNSBDATA'] ?? null, self::SOURCE_URL],
        );
        $stats['inserted']++;
    }
}
