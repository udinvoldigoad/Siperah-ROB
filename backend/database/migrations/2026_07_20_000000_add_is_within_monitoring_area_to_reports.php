<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ReportResource & DashboardController menghitung status "dalam wilayah
 * pantauan" ulang tiap kali laporan ditampilkan (query ST_DWithin per baris,
 * sampai ~870ms/laporan non-pesisir dengan 2.648 wilayah di DB) — padahal
 * nilainya sudah dihitung sekali saat submit (ReportController::store) dan
 * tidak pernah berubah. Simpan sebagai kolom agar tampilan tinggal baca.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ground_truth_reports', function (Blueprint $table): void {
            $table->boolean('is_within_monitoring_area')->nullable()->after('status');
        });

        // Backfill baris lama (jumlahnya kecil di semua environment saat ini)
        // lewat kode PHP, bukan SQL murni, agar logika identik dengan
        // RegionMonitoringService::isPointMonitored (termasuk fallback non-PostGIS).
        $monitoring = app(\App\Services\RegionMonitoringService::class);
        \App\Models\GroundTruthReport::whereNull('is_within_monitoring_area')
            ->with('region')
            ->chunkById(100, function ($reports) use ($monitoring): void {
                foreach ($reports as $report) {
                    $report->is_within_monitoring_area = $monitoring->isPointMonitored(
                        $report->region,
                        (float) $report->latitude,
                        (float) $report->longitude,
                    );
                    $report->save();
                }
            });
    }

    public function down(): void
    {
        Schema::table('ground_truth_reports', function (Blueprint $table): void {
            $table->dropColumn('is_within_monitoring_area');
        });
    }
};
