<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Mesin PostgreSQL lokal tanpa paket PostGIS tetap bisa dipakai untuk
        // development. Query laporan memakai fallback WKT pada kondisi ini.
        $postgisAvailable = (bool) DB::table('pg_available_extensions')
            ->where('name', 'postgis')
            ->exists();

        if (!$postgisAvailable) {
            return;
        }

        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');

        $geometryType = DB::table('information_schema.columns')
            ->where('table_schema', 'public')
            ->where('table_name', 'regions')
            ->where('column_name', 'geometry')
            ->value('udt_name');

        if ($geometryType !== 'geometry') {
            DB::statement(<<<'SQL'
                ALTER TABLE regions
                ALTER COLUMN geometry TYPE geometry(MultiPolygon, 4326)
                USING ST_Multi(ST_SetSRID(ST_GeomFromText(geometry), 4326))
            SQL);
        }

        DB::statement('ALTER TABLE ground_truth_reports ADD COLUMN location geometry(Point, 4326)');
        DB::statement(<<<'SQL'
            UPDATE ground_truth_reports
            SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        SQL);
        DB::statement('ALTER TABLE ground_truth_reports ALTER COLUMN location SET NOT NULL');

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION sync_ground_truth_report_location()
            RETURNS trigger AS $$
            BEGIN
                NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER ground_truth_reports_location_sync
            BEFORE INSERT OR UPDATE OF latitude, longitude ON ground_truth_reports
            FOR EACH ROW EXECUTE FUNCTION sync_ground_truth_report_location();
        SQL);

        DB::statement('CREATE INDEX regions_geometry_gix ON regions USING GIST (geometry)');
        DB::statement('CREATE INDEX reports_location_gix ON ground_truth_reports USING GIST (location)');
    }

    public function down(): void
    {
        $postgisInstalled = (bool) DB::table('pg_extension')
            ->where('extname', 'postgis')
            ->exists();

        if (!$postgisInstalled) {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS reports_location_gix');
        DB::statement('DROP INDEX IF EXISTS regions_geometry_gix');
        DB::statement('DROP TRIGGER IF EXISTS ground_truth_reports_location_sync ON ground_truth_reports');
        DB::statement('DROP FUNCTION IF EXISTS sync_ground_truth_report_location()');
        DB::statement('ALTER TABLE ground_truth_reports DROP COLUMN IF EXISTS location');
        DB::statement('ALTER TABLE regions ALTER COLUMN geometry TYPE text USING ST_AsText(geometry)');
    }
};
