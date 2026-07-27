<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Index untuk kolom yang sering difilter/di-join tapi belum terindeks.
 * Postgres TIDAK membuat index otomatis untuk foreign key, dan schema.sql hanya
 * mendefinisikan 3 index (koordinat, prediksi, audit action).
 *
 * Setiap index memetakan pola query nyata:
 *  - (user_id, created_at)   -> ReportAccessService::accessible() peran warga
 *                               + ReportController::index orderBy created_at desc
 *  - (status, created_at)    -> filter status di ReportController/Dashboard/PublicMap
 *                               (whereIn menunggu/perlu_review, where divalidasi)
 *  - (region_id)             -> join regions & filter region_id
 *  - (actor_user_id, created_at) -> statistik pemakaian API (ResearchController)
 *                               & filter AuditController
 *
 * Catatan: tabel masih kecil sehingga CREATE INDEX biasa (dalam transaksi migrasi)
 * berjalan seketika. Bila kelak tabel sudah besar, pertimbangkan CONCURRENTLY
 * dengan $withinTransaction = false agar tidak mengunci penulisan.
 */
return new class extends Migration
{
    private const INDEXES = [
        'reports_user_created_idx' => 'ground_truth_reports (user_id, created_at)',
        'reports_status_created_idx' => 'ground_truth_reports (status, created_at)',
        'reports_region_idx' => 'ground_truth_reports (region_id)',
        'audit_logs_actor_idx' => 'audit_logs (actor_user_id, created_at)',
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $name => $target) {
            DB::statement("CREATE INDEX IF NOT EXISTS {$name} ON {$target}");
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::INDEXES) as $name) {
            DB::statement("DROP INDEX IF EXISTS {$name}");
        }
    }
};
