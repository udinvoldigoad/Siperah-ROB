<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table): void {
            $table->string('region_code', 50)->nullable()->unique();
            $table->string('boundary_status', 30)->nullable();
            $table->string('source_edition', 30)->nullable();
            $table->timestampTz('source_synced_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('regions', function (Blueprint $table): void {
            $table->dropUnique(['region_code']);
            $table->dropColumn(['region_code', 'boundary_status', 'source_edition', 'source_synced_at']);
        });
    }
};
