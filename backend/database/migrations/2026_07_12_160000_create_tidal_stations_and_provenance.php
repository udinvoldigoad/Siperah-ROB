<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tidal_stations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 50)->unique();
            $table->string('name', 150);
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();
            $table->decimal('coverage_radius_km', 8, 2)->nullable();
            $table->string('default_datum', 20)->nullable();
            $table->string('timezone', 50)->default('Asia/Jakarta');
            $table->string('source', 100);
            $table->text('source_url')->nullable();
            $table->string('provenance_status', 20)->default('unverified');
            $table->string('status', 20)->default('active');
            $table->timestampsTz();
        });

        Schema::table('tidal_data', function (Blueprint $table): void {
            $table->uuid('station_id')->nullable()->after('id');
            $table->string('provenance_status', 20)->default('unverified');
            $table->string('quality_status', 20)->default('valid');
            $table->timestampTz('imported_at')->nullable();
            $table->foreign('station_id')->references('id')->on('tidal_stations')->nullOnDelete();
            $table->index(['station_id', 'recorded_at'], 'tidal_data_station_recorded_idx');
        });
    }

    public function down(): void
    {
        Schema::table('tidal_data', function (Blueprint $table): void {
            $table->dropIndex('tidal_data_station_recorded_idx');
            $table->dropForeign(['station_id']);
            $table->dropColumn(['station_id', 'provenance_status', 'quality_status', 'imported_at']);
        });

        Schema::dropIfExists('tidal_stations');
    }
};
