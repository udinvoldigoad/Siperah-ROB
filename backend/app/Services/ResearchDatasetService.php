<?php

namespace App\Services;

use App\Models\Dataset;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class ResearchDatasetService
{
    private const RECORD_COUNT_TTL_MINUTES = 30;

    public function dailyPredictionsQuery(): Builder
    {
        return DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->select([
                'predictions.id', 'predictions.prediction_date', 'predictions.risk_probability',
                'predictions.risk_class', 'predictions.confidence_score', 'predictions.max_tidal_height',
                'predictions.peak_time', 'predictions.model_version', 'predictions.generated_at',
                'predictions.provenance_status', 'regions.region_code', 'regions.village',
                'regions.district', 'regions.regency',
            ]);
    }

    public function validatedReportsQuery(): Builder
    {
        return DB::table('ground_truth_reports as reports')
            ->join('regions', 'reports.region_id', '=', 'regions.id')
            ->where('reports.status', 'divalidasi')
            ->selectRaw(
                'reports.id, reports.report_code, regions.region_code, regions.village, regions.district, regions.regency,
                 ROUND(reports.latitude, 3) AS latitude_approx,
                 ROUND(reports.longitude, 3) AS longitude_approx,
                 reports.severity, reports.water_height_cm, reports.incident_time, reports.validated_at'
            );
    }

    public function tidalQuery(): Builder
    {
        return DB::table('tidal_data')
            ->leftJoin('tidal_stations', 'tidal_data.station_id', '=', 'tidal_stations.id')
            ->select([
                'tidal_data.id', 'tidal_stations.code as station_code', 'tidal_stations.name as station_name',
                'tidal_data.recorded_at', 'tidal_data.tidal_height', 'tidal_data.unit', 'tidal_data.datum',
                'tidal_data.data_type', 'tidal_data.event_type', 'tidal_data.source',
                'tidal_data.provenance_status', 'tidal_data.quality_status',
            ]);
    }

    public function availableRegencies(): array
    {
        return DB::table('regions')
            ->whereNotNull('regency')
            ->where('coastal_flag', true)
            ->distinct()
            ->orderBy('regency')
            ->pluck('regency')
            ->values()
            ->all();
    }

    public function recordCount(Dataset $dataset): int
    {
        $signature = md5(json_encode([
            $dataset->dataset_type,
            $dataset->period_start?->toDateString(),
            $dataset->period_end?->toDateString(),
            $dataset->coverage_regencies,
        ]));

        return Cache::remember(
            "research:dataset-count:{$dataset->id}:{$signature}",
            now()->addMinutes(self::RECORD_COUNT_TTL_MINUTES),
            fn (): int => (int) $this->queryForDataset($dataset)[0]->count(),
        );
    }

    public function queryForDataset(Dataset $dataset): array
    {
        $type = mb_strtolower($dataset->dataset_type);

        $coverage = collect($dataset->coverage_regencies ?? [])
            ->map(fn (string $name) => preg_replace('/^(kabupaten|kota)\s+/i', '', mb_strtolower(trim($name))))
            ->filter()
            ->values();
        $regencyFilter = function (Builder $query) use ($coverage): Builder {
            if ($coverage->isEmpty()) {
                return $query;
            }
            return $query->where(function (Builder $q) use ($coverage): void {
                foreach ($coverage as $name) {
                    $q->orWhereRaw("REGEXP_REPLACE(LOWER(TRIM(regions.regency)), '^(kabupaten|kota)\\s+', '') = ?", [$name]);
                }
            });
        };

        if (str_contains($type, 'tidal') || str_contains($type, 'pasang')) {
            $query = $this->tidalQuery()
                ->when($dataset->period_start, fn (Builder $q) => $q->whereDate('recorded_at', '>=', $dataset->period_start))
                ->when($dataset->period_end, fn (Builder $q) => $q->whereDate('recorded_at', '<=', $dataset->period_end))
                ->orderByDesc('recorded_at');
            return [$query, 'tidal_data.csv'];
        }

        if (str_contains($type, 'ground truth') || str_contains($type, 'report')) {
            $query = $regencyFilter($this->validatedReportsQuery())
                ->when($dataset->period_start, fn (Builder $q) => $q->whereDate('reports.incident_time', '>=', $dataset->period_start))
                ->when($dataset->period_end, fn (Builder $q) => $q->whereDate('reports.incident_time', '<=', $dataset->period_end))
                ->orderByDesc('reports.incident_time');
            return [$query, 'validated_reports.csv'];
        }

        $query = $regencyFilter($this->dailyPredictionsQuery())
            ->when($dataset->period_start, fn (Builder $q) => $q->whereDate('prediction_date', '>=', $dataset->period_start))
            ->when($dataset->period_end, fn (Builder $q) => $q->whereDate('prediction_date', '<=', $dataset->period_end))
            ->orderByDesc('prediction_date');
        return [$query, 'daily_predictions.csv'];
    }
}
