<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_import_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('source', 100);
            $table->string('dataset_type', 50);
            $table->string('status', 20)->default('running');
            $table->unsignedBigInteger('fetched_count')->default(0);
            $table->unsignedBigInteger('valid_count')->default(0);
            $table->unsignedBigInteger('invalid_count')->default(0);
            $table->unsignedBigInteger('inserted_count')->default(0);
            $table->unsignedBigInteger('updated_count')->default(0);
            $table->jsonb('error_summary')->nullable();
            $table->text('source_reference')->nullable();
            $table->timestampTz('started_at')->useCurrent();
            $table->timestampTz('completed_at')->nullable();
            $table->index(['source', 'dataset_type', 'started_at']);
        });

        Schema::create('region_import_staging', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('run_id')->index();
            $table->string('region_code', 50);
            $table->string('province', 100);
            $table->string('regency', 100);
            $table->string('district', 100);
            $table->string('village', 100);
            $table->jsonb('geometry_geojson');
            $table->timestampsTz();
            $table->foreign('run_id')->references('id')->on('data_import_runs')->cascadeOnDelete();
            $table->unique(['run_id', 'region_code']);
        });

        foreach ([
            "ALTER TABLE regions ADD CONSTRAINT regions_provenance_check CHECK (provenance_status IN ('official','unverified','demo'))",
            "ALTER TABLE predictions ADD CONSTRAINT predictions_provenance_check CHECK (provenance_status IN ('official','unverified','demo'))",
            "ALTER TABLE tidal_data ADD CONSTRAINT tidal_provenance_check CHECK (provenance_status IN ('official','unverified','demo'))",
            "ALTER TABLE tidal_data ADD CONSTRAINT tidal_quality_check CHECK (quality_status IN ('valid','warning','rejected'))",
            "ALTER TABLE tidal_stations ADD CONSTRAINT tidal_stations_provenance_check CHECK (provenance_status IN ('official','unverified','demo'))",
            "ALTER TABLE tidal_stations ADD CONSTRAINT tidal_stations_radius_check CHECK (coverage_radius_km IS NULL OR coverage_radius_km >= 0)",
            "ALTER TABLE ground_truth_reports ADD CONSTRAINT reports_latitude_check CHECK (latitude BETWEEN -90 AND 90)",
            "ALTER TABLE ground_truth_reports ADD CONSTRAINT reports_longitude_check CHECK (longitude BETWEEN -180 AND 180)",
            "ALTER TABLE api_keys ADD CONSTRAINT api_keys_status_check CHECK (status IN ('aktif','nonaktif'))",
            "ALTER TABLE data_import_runs ADD CONSTRAINT import_runs_status_check CHECK (status IN ('running','completed','failed'))",
        ] as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        foreach ([
            ['data_import_runs', 'import_runs_status_check'],
            ['api_keys', 'api_keys_status_check'],
            ['ground_truth_reports', 'reports_longitude_check'],
            ['ground_truth_reports', 'reports_latitude_check'],
            ['tidal_stations', 'tidal_stations_radius_check'],
            ['tidal_stations', 'tidal_stations_provenance_check'],
            ['tidal_data', 'tidal_quality_check'],
            ['tidal_data', 'tidal_provenance_check'],
            ['predictions', 'predictions_provenance_check'],
            ['regions', 'regions_provenance_check'],
        ] as [$table, $constraint]) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$constraint}");
        }
        Schema::dropIfExists('region_import_staging');
        Schema::dropIfExists('data_import_runs');
    }
};
