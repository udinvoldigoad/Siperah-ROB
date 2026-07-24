<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Permohonan izin akses API oleh peneliti. Sebelum bisa membuat API key,
// peneliti wajib mengajukan izin (tujuan penggunaan) yang divalidasi admin di
// halaman "Perizinan". API key baru bisa dibuat setelah izin berstatus disetujui.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_access_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('purpose');                 // untuk kepentingan apa
            $table->string('organization')->nullable(); // instansi/lembaga
            $table->string('project_title')->nullable(); // judul penelitian/proyek
            $table->string('status', 20)->default('menunggu'); // menunggu|disetujui|ditolak
            $table->text('review_note')->nullable();  // catatan admin (mis. alasan tolak)
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['user_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_access_requests');
    }
};
