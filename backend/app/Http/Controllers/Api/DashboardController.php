<?php

namespace App\Http\Controllers\Api;

use App\Models\GroundTruthReport;
use App\Services\AuditService;
use App\Services\RegionMonitoringService;
use App\Services\ReportAccessService;
use App\Support\CsvWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DashboardController
{
    public function __construct(
        private readonly ReportAccessService $reports,
        private readonly AuditService $audit,
        private readonly RegionMonitoringService $monitoring,
    ) {}

    /**
     * FR-OPS-1—5: Dashboard operator BPBD kabupaten/kota.
     * Filter berdasarkan region_id operator (wilayah kerjanya).
     */
    public function operatorSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        $regionId = $user?->region_id;

        // Jika operator punya region, filter per regency yang sama
        $regency = null;
        if ($regionId) {
            $regency = DB::table('regions')->where('id', $regionId)->value('regency');
        }

        $regionQuery = $this->monitoredRegionsQuery();
        if ($regency) {
            $normalizedRegency = $this->normalizeRegency($regency);
            $regionQuery->whereRaw(
                "REGEXP_REPLACE(LOWER(TRIM(regency)), '^(kabupaten|kota)\\s+', '') = ?",
                [$normalizedRegency],
            );
        }
        $regionIds = $regionQuery->pluck('id');
        $latestPredictionDate = DB::table('predictions')
            ->whereIn('region_id', $regionIds)
            ->max('prediction_date');

        $monitored = $regionIds->count();

        $critical = DB::table('predictions')
            ->whereIn('region_id', $regionIds)
            ->where('risk_class', 'sangat_tinggi')
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('prediction_date', $latestPredictionDate))
            ->distinct('region_id')
            ->count('region_id');

        $pending = $this->reports->accessible($user)
            ->whereIn('status', ['menunggu', 'perlu_review'])
            ->count();

        $startOfMonth = Carbon::now()->startOfMonth();
        $monthlyValidations = $this->reports->accessible($user)
            ->where('status', 'divalidasi')
            ->where('validated_at', '>=', $startOfMonth)
            ->count();

        $riskStatuses = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->whereIn('predictions.region_id', $regionIds)
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('predictions.prediction_date', $latestPredictionDate))
            ->select([
                'regions.id',
                'regions.village',
                'regions.district',
                'regions.regency',
                'regions.population',
                'predictions.risk_class',
                'predictions.risk_probability',
                'predictions.max_tidal_height',
                'predictions.peak_time',
                'predictions.generated_at',
            ])
            ->orderByRaw("CASE predictions.risk_class WHEN 'sangat_tinggi' THEN 4 WHEN 'tinggi' THEN 3 WHEN 'sedang' THEN 2 ELSE 1 END DESC")
            ->orderByDesc('predictions.risk_probability')
            ->limit(25)
            ->get();

        $pendingReports = $this->reports->accessible($user)
            ->with(['region', 'reporter'])
            ->whereIn('status', ['menunggu', 'perlu_review'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (GroundTruthReport $report) => $this->reportSummary($report));

        return response()->json(['data' => [
            'monitored_villages' => $monitored,
            'critical_villages' => $critical,
            'pending_reports' => $pending,
            'monthly_validations' => $monthlyValidations,
            'latest_prediction_date' => $latestPredictionDate,
            'operator_regency' => $regency,
            'region_statuses' => $riskStatuses,
            'pending_report_queue' => $pendingReports,
        ]]);
    }

    /**
     * FR-PROV-1—4: Dashboard BPBD provinsi lintas kabupaten.
     */
    public function provinceSummary(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'regency' => ['nullable', 'string', 'max:100'],
        ]);
        $selectedMonth = $filters['month'] ?? null;
        $selectedRegency = $filters['regency'] ?? null;

        $latestPredictionDate = $this->latestProvincePredictionDate($selectedMonth, $selectedRegency);

        $regencies = $this->monitoredRegionsQuery()
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->distinct('regency')
            ->count('regency');

        $highRisk = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->whereIn('risk_class', ['tinggi', 'sangat_tinggi'])
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('prediction_date', $latestPredictionDate))
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->distinct('region_id')
            ->count('predictions.region_id');

        $population = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('predictions.prediction_date', $latestPredictionDate))
            ->whereIn('predictions.risk_class', ['tinggi', 'sangat_tinggi'])
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->sum('regions.population');

        $startOfMonth = $selectedMonth ? Carbon::createFromFormat('Y-m', $selectedMonth)->startOfMonth() : Carbon::now()->startOfMonth();
        $endOfMonth = (clone $startOfMonth)->endOfMonth();
        $validatedThisMonth = DB::table('ground_truth_reports')
            ->join('regions', 'ground_truth_reports.region_id', '=', 'regions.id')
            ->where('status', 'divalidasi')
            ->whereBetween('validated_at', [$startOfMonth, $endOfMonth])
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->count();

        $regencyRows = $this->regencyRiskRows($latestPredictionDate, $selectedRegency);

        // FR-PROV-3: grafik prediksi 30 hari KE DEPAN, jumlah kelurahan kelas
        // Sangat Tinggi (utama) + Tinggi (sekunder). Anchor ke hari ini karena
        // ini forecast — bukan mundur dari tanggal prediksi terjauh.
        $trendStart = Carbon::now()->toDateString();
        $trendEnd = Carbon::now()->addDays(29)->toDateString();
        $trend = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->selectRaw("
                prediction_date,
                COUNT(DISTINCT CASE WHEN risk_class = 'sangat_tinggi' THEN region_id END) AS critical_count,
                COUNT(DISTINCT CASE WHEN risk_class = 'tinggi' THEN region_id END) AS high_count,
                COUNT(DISTINCT CASE WHEN risk_class IN ('tinggi', 'sangat_tinggi') THEN region_id END) AS high_risk_count,
                AVG(risk_probability) AS avg_probability,
                MAX(risk_probability) AS max_probability
            ")
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->whereBetween('prediction_date', [$trendStart, $trendEnd])
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->groupBy('prediction_date')
            ->orderBy('prediction_date')
            ->get();
        $populationAudit = $this->populationAudit($selectedRegency);

        return response()->json(['data' => [
            'monitored_regencies' => $regencies,
            'high_risk_villages' => $highRisk,
            'risk_population' => (int) $population,
            'validated_reports_this_month' => $validatedThisMonth,
            'latest_prediction_date' => $latestPredictionDate,
            'regencies' => $regencyRows,
            'trend_30_days' => $trend,
            'filters' => [
                'month' => $selectedMonth,
                'regency' => $selectedRegency,
            ],
            'available_regencies' => $this->provinceRegencyOptions(),
            'top_impacted' => $this->topImpactedRows($latestPredictionDate, $selectedRegency),
            'population_audit' => $populationAudit,
        ]]);
    }

    public function provinceExport(Request $request): StreamedResponse
    {
        $filters = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'regency' => ['nullable', 'string', 'max:100'],
        ]);
        $latestPredictionDate = $this->latestProvincePredictionDate($filters['month'] ?? null, $filters['regency'] ?? null);
        $rows = $this->regencyRiskRows($latestPredictionDate, $filters['regency'] ?? null);
        $this->audit->write($request, 'export_province_dashboard', 'success', 'dashboard:province', $filters);

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'wb');
            CsvWriter::putRow($output, ['Kabupaten/Kota', 'Rendah', 'Sedang', 'Tinggi', 'Sangat Tinggi', 'Populasi Risiko', 'Peluang Maksimum', 'Tren']);
            foreach ($rows as $row) {
                CsvWriter::putRow($output, [
                    $row->regency,
                    $row->low_count,
                    $row->medium_count,
                    $row->high_count,
                    $row->critical_count,
                    $row->risk_population,
                    $row->max_probability,
                    $row->trend,
                ]);
            }
            fclose($output);
        }, 'dashboard-provinsi-risiko.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function operatorReportsExport(Request $request): StreamedResponse
    {
        $rows = $this->reports->accessible($request->user())
            ->with('region')
            ->latest()
            ->limit(1000)
            ->get();
        $this->audit->write($request, 'export_operator_reports', 'success', 'dashboard:operator_reports', [
            'rows' => $rows->count(),
        ]);

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'wb');
            CsvWriter::putRow($output, ['Kode', 'Status', 'Keparahan', 'Tinggi Air CM', 'Wilayah', 'Waktu Kejadian', 'SLA', 'Dibuat']);
            foreach ($rows as $report) {
                $summary = $this->reportSummary($report);
                CsvWriter::putRow($output, [
                    $report->report_code,
                    $report->status,
                    $report->severity,
                    $report->water_height_cm,
                    $summary['location'],
                    optional($report->incident_time)->toIso8601String(),
                    $summary['sla_status'],
                    optional($report->created_at)->toIso8601String(),
                ]);
            }
            fclose($output);
        }, 'dashboard-operator-laporan.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function regencyRiskRows(?string $latestPredictionDate, ?string $selectedRegency = null)
    {
        $previousPredictionDate = $latestPredictionDate
            ? DB::table('predictions')
                ->join('regions', 'predictions.region_id', '=', 'regions.id')
                ->whereDate('predictions.prediction_date', '<', $latestPredictionDate)
                ->where(function ($query): void {
                    $this->applyMonitoredRegionFilter($query, 'regions');
                })
                ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
                ->max('predictions.prediction_date')
            : null;

        $previousRows = $previousPredictionDate
            ? DB::table('predictions')
                ->join('regions', 'predictions.region_id', '=', 'regions.id')
                ->where(function ($query): void {
                    $this->applyMonitoredRegionFilter($query, 'regions');
                })
                ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
                ->whereDate('predictions.prediction_date', $previousPredictionDate)
                ->selectRaw("
                    regions.regency,
                    COUNT(DISTINCT CASE WHEN predictions.risk_class IN ('tinggi', 'sangat_tinggi') THEN predictions.region_id END) AS previous_high_risk_count
                ")
                ->groupBy('regions.regency')
                ->pluck('previous_high_risk_count', 'regency')
            : collect();

        return DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('predictions.prediction_date', $latestPredictionDate))
            ->selectRaw("
                regions.regency,
                SUM(CASE WHEN predictions.risk_class = 'rendah' THEN 1 ELSE 0 END) AS low_count,
                SUM(CASE WHEN predictions.risk_class = 'sedang' THEN 1 ELSE 0 END) AS medium_count,
                SUM(CASE WHEN predictions.risk_class = 'tinggi' THEN 1 ELSE 0 END) AS high_count,
                SUM(CASE WHEN predictions.risk_class = 'sangat_tinggi' THEN 1 ELSE 0 END) AS critical_count,
                SUM(COALESCE(regions.population, 0)) AS risk_population,
                MAX(predictions.risk_probability) AS max_probability
            ")
            ->groupBy('regions.regency')
            ->orderByDesc('critical_count')
            ->orderByDesc('high_count')
            ->get()
            ->map(function ($row) use ($previousRows) {
                $currentHighRisk = (int) $row->critical_count + (int) $row->high_count;
                $previousHighRisk = (int) ($previousRows[$row->regency] ?? 0);
                $delta = $currentHighRisk - $previousHighRisk;
                $row->previous_high_risk_count = $previousHighRisk;
                $row->high_risk_delta = $delta;
                $row->trend = $delta > 0 ? 'naik' : ($delta < 0 ? 'turun' : 'stabil');
                return $row;
            });
    }

    private function latestProvincePredictionDate(?string $selectedMonth = null, ?string $selectedRegency = null): ?string
    {
        return DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->when($selectedMonth, function ($query, string $month): void {
                $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth()->toDateString();
                $end = Carbon::createFromFormat('Y-m', $month)->endOfMonth()->toDateString();
                $query->whereBetween('predictions.prediction_date', [$start, $end]);
            })
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->max('predictions.prediction_date');
    }

    private function provinceRegencyOptions()
    {
        return $this->monitoredRegionsQuery()
            ->whereNotNull('regency')
            ->distinct()
            ->orderBy('regency')
            ->pluck('regency')
            ->values();
    }

    private function topImpactedRows(?string $latestPredictionDate, ?string $selectedRegency = null)
    {
        return DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('predictions.prediction_date', $latestPredictionDate))
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'))
            ->select([
                'predictions.id',
                'predictions.prediction_date',
                'predictions.risk_probability',
                'predictions.risk_class',
                'predictions.confidence_score',
                'predictions.max_tidal_height',
                'regions.village',
                'regions.district',
                'regions.regency',
                'regions.population',
                'regions.data_source as population_source',
                'regions.provenance_status as population_provenance_status',
            ])
            ->orderByRaw("CASE predictions.risk_class WHEN 'sangat_tinggi' THEN 4 WHEN 'tinggi' THEN 3 WHEN 'sedang' THEN 2 ELSE 1 END DESC")
            ->orderByDesc('predictions.risk_probability')
            ->orderByDesc('regions.population')
            ->limit(10)
            ->get();
    }

    private function populationAudit(?string $selectedRegency = null): array
    {
        $query = $this->monitoredRegionsQuery()
            ->when($selectedRegency, fn ($query, string $regency) => $this->applyRegencyFilter($query, $regency, 'regions'));

        $total = (clone $query)->count();
        $withPopulation = (clone $query)->whereNotNull('population')->where('population', '>', 0)->count();
        $official = (clone $query)
            ->whereNotNull('population')
            ->where('population', '>', 0)
            ->where(function ($items): void {
                $items->whereRaw("LOWER(COALESCE(data_source, '')) LIKE '%bps%'")
                    ->orWhereRaw("LOWER(COALESCE(source_reference, '')) LIKE '%bps%'");
            })
            ->count();

        return [
            'total_regions' => $total,
            'with_population' => $withPopulation,
            'official_bps_population' => $official,
            'missing_population' => max(0, $total - $withPopulation),
            'status' => $total > 0 && $official === $total ? 'bps_verified' : ($withPopulation === $total ? 'region_population_available' : 'incomplete'),
        ];
    }

    private function reportSummary(GroundTruthReport $report): array
    {
        $slaDueAt = $report->created_at?->copy()->addDay();
        $isResolved = in_array($report->status, ['divalidasi', 'ditolak', 'duplikat'], true);

        return [
            'id' => $report->id,
            'report_code' => $report->report_code,
            'severity' => $report->severity,
            'status' => $report->status,
            'water_height_cm' => $report->water_height_cm,
            'incident_time' => optional($report->incident_time)->toIso8601String(),
            'created_at' => optional($report->created_at)->toIso8601String(),
            'sla_due_at' => $slaDueAt?->toIso8601String(),
            'sla_status' => $isResolved ? 'selesai' : ($slaDueAt && now()->greaterThan($slaDueAt) ? 'terlambat' : 'berjalan'),
            'location' => trim(implode(', ', array_filter([
                $report->region?->village,
                $report->region?->district,
                $report->region?->regency,
            ]))),
            'reporter_name' => $report->reporter?->name,
            'is_within_monitoring_area' => $this->monitoring->isReportWithinMonitoringArea($report),
        ];
    }

    private function monitoredRegionsQuery()
    {
        return DB::table('regions')
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            });
    }

    private function applyMonitoredRegionFilter($query, string $regionTable): void
    {
        $query->where("{$regionTable}.coastal_flag", true)
            ->orWhereExists(function ($exists) use ($regionTable): void {
                $exists->selectRaw('1')
                    ->from('predictions as monitored_predictions')
                    ->whereColumn('monitored_predictions.region_id', "{$regionTable}.id");
            });
    }

    private function applyRegencyFilter($query, string $regency, string $regionTable): void
    {
        $query->whereRaw(
            "REGEXP_REPLACE(LOWER(TRIM({$regionTable}.regency)), '^(kabupaten|kota)\\s+', '') = ?",
            [$this->normalizeRegency($regency)],
        );
    }

    private function normalizeRegency(string $regency): string
    {
        return preg_replace('/^(kabupaten|kota)\s+/i', '', mb_strtolower(trim($regency))) ?? '';
    }
}
