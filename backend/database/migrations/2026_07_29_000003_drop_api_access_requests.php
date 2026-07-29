<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Buang tabel `api_access_requests`.
 *
 * Izin akses data kini diminta SEKALI saat akun peneliti dibuat
 * (`users.research_purpose`, wajib diisi, akun lahir berstatus `menunggu`),
 * bukan lagi sebagai permohonan kedua sebelum membuat kunci API. Dua kolom
 * yang menanyakan hal serupa di dua layar berbeda membuat admin meninjau
 * alasan yang sama dua kali tanpa saling merujuk.
 *
 * Aman dibuang: di produksi tabel ini berisi NOL baris, dan tak ada satu pun
 * kunci API yang pernah dibuat - diperiksa langsung ke DB produksi sebelum
 * migrasi ini ditulis.
 *
 * `down()` mengembalikan strukturnya persis seperti migrasi aslinya; isinya
 * tidak, dan memang tak ada yang perlu dikembalikan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('api_access_requests');
    }

    public function down(): void
    {
        if (Schema::hasTable('api_access_requests')) {
            return;
        }

        Schema::create('api_access_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('purpose');
            $table->string('organization')->nullable();
            $table->string('project_title')->nullable();
            $table->string('status', 20)->default('menunggu');
            $table->text('review_note')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['user_id', 'status']);
            $table->index('status');
        });
    }
};
