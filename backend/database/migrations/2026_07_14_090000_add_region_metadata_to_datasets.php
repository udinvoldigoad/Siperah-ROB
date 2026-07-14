<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('datasets', function (Blueprint $table): void {
            // Daftar kabupaten/kota yang dicakup dataset. NULL/[] = mencakup seluruh provinsi.
            $table->jsonb('coverage_regencies')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('datasets', function (Blueprint $table): void {
            $table->dropColumn('coverage_regencies');
        });
    }
};
