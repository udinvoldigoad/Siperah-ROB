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

    public function supportsDistanceQueries(): bool
    {
        return $this->postgisAvailable();
    }

    private function postgisAvailable(): bool
    {
        return false;
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
}
