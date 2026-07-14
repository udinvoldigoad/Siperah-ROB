<?php

namespace App\Services;

use App\Models\Region;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final class RegionMonitoringService
{
    private const POINT_MONITORING_RADIUS_METERS = 5000;

    public function isMonitored(?Region $region): bool
    {
        if (!$region) {
            return false;
        }

        if ((bool) $region->coastal_flag) {
            return true;
        }

        return $region->predictions()->exists();
    }

    public function isPointMonitored(?Region $region, float $latitude, float $longitude): bool
    {
        if ($this->isMonitored($region)) {
            return true;
        }

        if (!$this->postgisAvailable()) {
            return $this->isPointNearMonitoredGeometryFallback($latitude, $longitude);
        }

        return Region::query()
            ->where(function (Builder $query): void {
                $this->monitoredRegionConstraint($query);
            })
            ->whereRaw(
                'ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
                [$longitude, $latitude, self::POINT_MONITORING_RADIUS_METERS],
            )
            ->exists();
    }

    public function isReportWithinMonitoringArea(?object $report): bool
    {
        if (!$report) {
            return false;
        }

        if (isset($report->is_within_monitoring_area)) {
            return (bool) $report->is_within_monitoring_area;
        }

        $region = $report->region ?? null;
        $latitude = $report->latitude ?? null;
        $longitude = $report->longitude ?? null;

        if ($region instanceof Region && is_numeric($latitude) && is_numeric($longitude)) {
            return $this->isPointMonitored($region, (float) $latitude, (float) $longitude);
        }

        return $region instanceof Region && $this->isMonitored($region);
    }

    public function monitoredRegionConstraint(Builder $query): void
    {
        $query->where('coastal_flag', true)
            ->orWhereHas('predictions');
    }

    public function unmonitoredRegionConstraint(Builder $query): void
    {
        $query->where('coastal_flag', false)
            ->whereDoesntHave('predictions');
    }

    private function postgisAvailable(): bool
    {
        return (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
    }

    private function isPointNearMonitoredGeometryFallback(float $latitude, float $longitude): bool
    {
        return Region::query()
            ->where(function (Builder $query): void {
                $this->monitoredRegionConstraint($query);
            })
            ->get(['geometry'])
            ->contains(fn (Region $region) => $this->pointIsNearGeometryBounds(
                $region->geometry,
                $latitude,
                $longitude,
                self::POINT_MONITORING_RADIUS_METERS,
            ));
    }

    private function pointIsNearGeometryBounds(?string $geometry, float $latitude, float $longitude, int $radiusMeters): bool
    {
        $bounds = $this->geometryBounds($geometry);
        if (!$bounds) {
            return false;
        }

        [$minLon, $minLat, $maxLon, $maxLat] = $bounds;
        $latPadding = $radiusMeters / 111_320;
        $lonPadding = $radiusMeters / (111_320 * max(cos(deg2rad($latitude)), 0.01));

        return $longitude >= ($minLon - $lonPadding)
            && $longitude <= ($maxLon + $lonPadding)
            && $latitude >= ($minLat - $latPadding)
            && $latitude <= ($maxLat + $latPadding);
    }

    private function geometryBounds(?string $geometry): ?array
    {
        if (!$geometry) {
            return null;
        }

        $points = [];
        if (str_starts_with(ltrim($geometry), '{')) {
            $decoded = json_decode($geometry, true);
            $collect = function (mixed $value) use (&$collect, &$points): void {
                if (!is_array($value)) return;
                if (isset($value[0], $value[1]) && is_numeric($value[0]) && is_numeric($value[1])) {
                    $points[] = [(float) $value[0], (float) $value[1]];
                    return;
                }
                foreach ($value as $item) $collect($item);
            };
            $collect($decoded['coordinates'] ?? []);
        } else {
            preg_match_all('/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/', $geometry, $matches, PREG_SET_ORDER);
            $points = array_map(fn (array $match) => [(float) $match[1], (float) $match[2]], $matches);
        }

        if ($points === []) {
            return null;
        }

        $longitudes = array_column($points, 0);
        $latitudes = array_column($points, 1);

        return [min($longitudes), min($latitudes), max($longitudes), max($latitudes)];
    }
}
