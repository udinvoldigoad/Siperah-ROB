<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Normalisasi taksonomi boundary_status: official / estimated / manual / invalid.
     * - 'reference' (istilah lama sinkron BIG) -> 'official' (sumber resmi BIG, edisi tercatat).
     * - Baris demo (provenance 'demo', kotak WKT buatan tangan) -> 'manual'.
     * Idempotent: aman dijalankan berulang.
     */
    public function up(): void
    {
        DB::table('regions')->where('boundary_status', 'reference')->update(['boundary_status' => 'official']);
        DB::table('regions')->whereNull('boundary_status')->where('provenance_status', 'demo')->update(['boundary_status' => 'manual']);
    }

    public function down(): void
    {
        DB::table('regions')->where('boundary_status', 'official')->update(['boundary_status' => 'reference']);
        DB::table('regions')->where('boundary_status', 'manual')->where('provenance_status', 'demo')->update(['boundary_status' => null]);
    }
};
