<?php

namespace App\Services;

use App\Models\Region;
use Illuminate\Support\Facades\DB;

final class RegionLocator
{
    private const MAX_NEAREST_REGION_METERS = 25000;

    public function locate(?float $latitude, ?float $longitude): ?Region
    {
        if ($latitude === null || $longitude === null) {
            return Region::where('coastal_flag', true)->first();
        }

        if (!$this->postgisAvailable()) {
            return Region::where('coastal_flag', true)
                ->get()
                ->first(fn (Region $region) => $this->pointIsInsideWktBounds(
                    $region->geometry,
                    $latitude,
                    $longitude,
                ));
        }

        $point = [$longitude, $latitude];
        $covered = Region::where('coastal_flag', true)
            ->whereRaw(
                'ST_Covers(geometry, ST_SetSRID(ST_MakePoint(?, ?), 4326))',
                $point,
            )
            ->first();

        if ($covered) {
            return $covered;
        }

        return Region::where('coastal_flag', true)
            ->whereRaw(
                'ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
                [...$point, self::MAX_NEAREST_REGION_METERS],
            )
            ->selectRaw(
                'regions.*, ST_Distance(geometry::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) AS distance_meters',
                $point,
            )
            ->orderBy('distance_meters')
            ->first();
    }

    public function locateAdministrative(float $latitude, float $longitude, string $province = 'Lampung'): ?Region
    {
        $base = Region::whereRaw('LOWER(province) = LOWER(?)', [$province]);

        if (!$this->postgisAvailable()) {
            return $base->get()
                ->filter(fn (Region $region) => $this->pointIsInsideWktBounds(
                    $region->geometry,
                    $latitude,
                    $longitude,
                ))
                ->sortBy(fn (Region $region) => $this->geometryBoundingArea($region->geometry))
                ->first();
        }

        return $base
            ->whereRaw(
                'ST_Covers(geometry, ST_SetSRID(ST_MakePoint(?, ?), 4326))',
                [$longitude, $latitude],
            )
            ->orderByRaw('ST_Area(geometry::geography) ASC')
            ->first();
    }

    public function supportsDistanceQueries(): bool
    {
        return $this->postgisAvailable();
    }

    private function postgisAvailable(): bool
    {
        return (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
    }

    private function pointIsInsideWktBounds(?string $wkt, float $latitude, float $longitude): bool
    {
        if (!$wkt) {
            return false;
        }

        if (str_starts_with(ltrim($wkt), '{')) {
            $decoded = json_decode($wkt, true);
            return $this->pointInGeoJson($decoded, $longitude, $latitude);
        }

        preg_match_all('/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/', $wkt, $matches, PREG_SET_ORDER);
        if ($matches === []) {
            return false;
        }

        $longitudes = array_map(fn (array $match) => (float) $match[1], $matches);
        $latitudes = array_map(fn (array $match) => (float) $match[2], $matches);

        return $longitude >= min($longitudes) && $longitude <= max($longitudes)
            && $latitude >= min($latitudes) && $latitude <= max($latitudes);
    }

    private function pointInGeoJson(mixed $geometry, float $longitude, float $latitude): bool
    {
        if (!is_array($geometry)) return false;
        $polygons = match ($geometry['type'] ?? null) {
            'Polygon' => [$geometry['coordinates'] ?? []],
            'MultiPolygon' => $geometry['coordinates'] ?? [],
            default => [],
        };

        foreach ($polygons as $rings) {
            if (!isset($rings[0]) || !$this->pointInRing($rings[0], $longitude, $latitude)) continue;
            $insideHole = false;
            foreach (array_slice($rings, 1) as $hole) {
                if ($this->pointInRing($hole, $longitude, $latitude)) {
                    $insideHole = true;
                    break;
                }
            }
            if (!$insideHole) return true;
        }

        return false;
    }

    private function pointInRing(array $ring, float $longitude, float $latitude): bool
    {
        $inside = false;
        $count = count($ring);
        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            if (!isset($ring[$i][0], $ring[$i][1], $ring[$j][0], $ring[$j][1])) continue;
            [$xi, $yi] = [(float) $ring[$i][0], (float) $ring[$i][1]];
            [$xj, $yj] = [(float) $ring[$j][0], (float) $ring[$j][1]];
            $intersects = (($yi > $latitude) !== ($yj > $latitude))
                && ($longitude < (($xj - $xi) * ($latitude - $yi) / (($yj - $yi) ?: PHP_FLOAT_EPSILON)) + $xi);
            if ($intersects) $inside = !$inside;
        }

        return $inside;
    }

    private function geometryBoundingArea(?string $geometry): float
    {
        if (!$geometry) return PHP_FLOAT_MAX;
        if (str_starts_with(ltrim($geometry), '{')) {
            $decoded = json_decode($geometry, true);
            $points = [];
            $collect = function (mixed $value) use (&$collect, &$points): void {
                if (!is_array($value)) return;
                if (isset($value[0], $value[1]) && is_numeric($value[0]) && is_numeric($value[1])) {
                    $points[] = [(float) $value[0], (float) $value[1]];
                    return;
                }
                foreach ($value as $item) $collect($item);
            };
            $collect($decoded['coordinates'] ?? []);
            if ($points === []) return PHP_FLOAT_MAX;
            $lng = array_column($points, 0);
            $lat = array_column($points, 1);
            return (max($lng) - min($lng)) * (max($lat) - min($lat));
        }

        preg_match_all('/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/', $geometry, $matches, PREG_SET_ORDER);
        if ($matches === []) return PHP_FLOAT_MAX;
        $lng = array_map(fn (array $match) => (float) $match[1], $matches);
        $lat = array_map(fn (array $match) => (float) $match[2], $matches);
        return (max($lng) - min($lng)) * (max($lat) - min($lat));
    }
}
