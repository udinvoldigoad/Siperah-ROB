<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alasan permohonan akun peneliti.
 *
 * Pendaftaran peneliti berhenti di status `menunggu`, jadi admin harus punya
 * dasar untuk memutuskan. Sebelumnya satu-satunya petunjuk adalah `institution`
 * — nama instansi saja tidak menjelaskan APA yang akan dilakukan dengan data,
 * sehingga `UserResource` sempat mengarang kalimat "Permohonan akses data untuk
 * institusi X" yang tak menambah informasi apa pun.
 *
 * Kolomnya `text`, bukan `varchar`: isian ini kalimat bebas dari pemohon.
 */
return new class extends Migration
{
    /** IDEMPOTEN — `database/schema.sql` juga memuat kolom ini, jadi pada
     *  database baru kolomnya sudah ada sebelum migrasi berjalan. */
    public function up(): void
    {
        if (Schema::hasColumn('users', 'research_purpose')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->text('research_purpose')->nullable()->after('institution');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('research_purpose');
        });
    }
};
