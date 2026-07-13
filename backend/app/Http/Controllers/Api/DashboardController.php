<?php

namespace App\Http\Controllers\Api;

use App\Models\GroundTruthReport;
use App\Services\AuditService;
use App\Services\RegionMonitoringService;
use App\Services\ReportAccessService;
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
            $regionQuery->where('regency', $regency);
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
        $monthlyValidations = DB::table('ground_truth_reports')
            ->whereIn('region_id', $regionIds)
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
            'region_statuses' => $riskStatuses,
            'pending_report_queue' => $pendingReports,
        ]]);
    }

    /**
     * FR-PROV-1—4: Dashboard BPBD provinsi lintas kabupaten.
     */
    public function provinceSummary(): JsonResponse
    {
        $latestPredictionDate = DB::table('predictions')->max('prediction_date');

        $regencies = $this->monitoredRegionsQuery()
            ->distinct('regency')
            ->count('regency');

        $highRisk = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->whereIn('risk_class', ['tinggi', 'sangat_tinggi'])
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('prediction_date', $latestPredictionDate))
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->distinct('region_id')
            ->count('predictions.region_id');

        $population = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('predictions.prediction_date', $latestPredictionDate))
            ->whereIn('predictions.risk_class', ['tinggi', 'sangat_tinggi'])
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->sum('regions.population');

        $startOfMonth = Carbon::now()->startOfMonth();
        $validatedThisMonth = DB::table('ground_truth_reports')
            ->where('status', 'divalidasi')
            ->where('validated_at', '>=', $startOfMonth)
            ->count();

        $regencyRows = $this->regencyRiskRows($latestPredictionDate);
        $trend = DB::table('predictions')
            ->selectRaw("prediction_date, COUNT(DISTINCT CASE WHEN risk_class IN ('tinggi', 'sangat_tinggi') THEN region_id END) AS high_risk_count")
            ->when($latestPredictionDate, fn ($query) => $query->whereBetween('prediction_date', [
                Carbon::parse($latestPredictionDate)->subDays(29)->toDateString(),
                Carbon::parse($latestPredictionDate)->toDateString(),
            ]))
            ->groupBy('prediction_date')
            ->orderBy('prediction_date')
            ->get();

        return response()->json(['data' => [
            'monitored_regencies' => $regencies,
            'high_risk_villages' => $highRisk,
            'risk_population' => (int) $population,
            'validated_reports_this_month' => $validatedThisMonth,
            'latest_prediction_date' => $latestPredictionDate,
            'regencies' => $regencyRows,
            'trend_30_days' => $trend,
        ]]);
    }

    public function provinceExport(): StreamedResponse
    {
        $latestPredictionDate = DB::table('predictions')->max('prediction_date');
        $rows = $this->regencyRiskRows($latestPredictionDate);
        $this->audit->write(request(), 'export_province_dashboard', 'success', 'dashboard:province');

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'wb');
            fputcsv($output, ['Kabupaten/Kota', 'Rendah', 'Sedang', 'Tinggi', 'Sangat Tinggi', 'Populasi Risiko', 'Peluang Maksimum', 'Tren'], ',', '"', '');
            foreach ($rows as $row) {
                fputcsv($output, [
                    $row->regency,
                    $row->low_count,
                    $row->medium_count,
                    $row->high_count,
                    $row->critical_count,
                    $row->risk_population,
                    $row->max_probability,
                    $row->trend,
                ], ',', '"', '');
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
            fputcsv($output, ['Kode', 'Status', 'Keparahan', 'Tinggi Air CM', 'Wilayah', 'Waktu Kejadian', 'SLA', 'Dibuat'], ',', '"', '');
            foreach ($rows as $report) {
                $summary = $this->reportSummary($report);
                fputcsv($output, [
                    $report->report_code,
                    $report->status,
                    $report->severity,
                    $report->water_height_cm,
                    $summary['location'],
                    optional($report->incident_time)->toIso8601String(),
                    $summary['sla_status'],
                    optional($report->created_at)->toIso8601String(),
                ], ',', '"', '');
            }
            fclose($output);
        }, 'dashboard-operator-laporan.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function regencyRiskRows(?string $latestPredictionDate)
    {
        return DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->where(function ($query): void {
                $this->applyMonitoredRegionFilter($query, 'regions');
            })
            ->when($latestPredictionDate, fn ($query) => $query->whereDate('predictions.prediction_date', $latestPredictionDate))
            ->selectRaw("
                regions.regency,
                SUM(CASE WHEN predictions.risk_class = 'rendah' THEN 1 ELSE 0 END) AS low_count,
                SUM(CASE WHEN predictions.risk_class = 'sedang' THEN 1 ELSE 0 END) AS medium_count,
                SUM(CASE WHEN predictions.risk_class = 'tinggi' THEN 1 ELSE 0 END) AS high_count,
                SUM(CASE WHEN predictions.risk_class = 'sangat_tinggi' THEN 1 ELSE 0 END) AS critical_count,
                SUM(CASE WHEN predictions.risk_class IN ('tinggi', 'sangat_tinggi') THEN COALESCE(regions.population, 0) ELSE 0 END) AS risk_population,
                MAX(predictions.risk_probability) AS max_probability
            ")
            ->groupBy('regions.regency')
            ->orderByDesc('critical_count')
            ->orderByDesc('high_count')
            ->get()
            ->map(function ($row) {
                $row->trend = ((int) $row->critical_count + (int) $row->high_count) > 0 ? 'naik' : 'stabil';
                return $row;
            });
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
}
