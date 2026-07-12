<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $postgis = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        Schema::create('coastlines', function (Blueprint $table) use ($postgis): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('source_object_id')->unique();
            if (!$postgis) $table->jsonb('geometry_geojson');
            $table->integer('shoreline_type')->nullable();
            $table->string('source_year', 20)->nullable();
            $table->string('source', 100);
            $table->text('source_reference');
            $table->timestampTz('source_synced_at');
            $table->timestampsTz();
        });
        if ($postgis) {
            DB::statement('ALTER TABLE coastlines ADD COLUMN geometry geometry(MultiLineString, 4326) NOT NULL');
            DB::statement('CREATE INDEX coastlines_geometry_gix ON coastlines USING GIST (geometry)');
        }
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS coastlines');
    }
};
