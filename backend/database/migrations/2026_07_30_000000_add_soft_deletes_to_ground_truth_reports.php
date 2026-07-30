<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Soft delete laporan ground truth: laporan adalah bukti lapangan yang menopang
// validasi dan jejak audit. Penghapusan permanen sebelumnya merupakan akar 45
// job antrean gagal di produksi. Dengan soft deletes, laporan yang "dihapus"
// tetap tersimpan untuk audit trail dan dapat dipulihkan jika diperlukan.
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('ground_truth_reports', 'deleted_at')) {
            Schema::table('ground_truth_reports', function (Blueprint $table): void {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('ground_truth_reports', 'deleted_at')) {
            Schema::table('ground_truth_reports', function (Blueprint $table): void {
                $table->dropSoftDeletes();
            });
        }
    }
};
