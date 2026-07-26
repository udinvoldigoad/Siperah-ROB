<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Provenance populasi dipisah dari provenance batas wilayah. Kolom
 * regions.data_source/provenance_status menggambarkan sumber GEOMETRI (BIG) —
 * angka populasi yang menumpang di kolom itu ikut terklaim "official BIG"
 * padahal BIG tidak menerbitkan data populasi. Tiga kolom baru ini membuat
 * jejak sumber populasi eksplisit dan bisa diaudit terpisah.
 *
 * Nilai populasi lama (entri manual tanpa sumber) diturunkan ke status
 * 'unverified' — angkanya tidak dihapus, tapi tidak lagi mengklaim resmi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table): void {
            $table->string('population_source')->nullable()->after('population');
            $table->string('population_source_reference')->nullable()->after('population_source');
            $table->string('population_provenance_status', 32)->nullable()->after('population_source_reference');
        });

        DB::table('regions')
            ->whereNotNull('population')
            ->where('population', '>', 0)
            ->update([
                'population_source' => 'Entri manual (sumber tidak terverifikasi)',
                'population_source_reference' => null,
                'population_provenance_status' => 'unverified',
            ]);
    }

    public function down(): void
    {
        Schema::table('regions', function (Blueprint $table): void {
            $table->dropColumn(['population_source', 'population_source_reference', 'population_provenance_status']);
        });
    }
};
