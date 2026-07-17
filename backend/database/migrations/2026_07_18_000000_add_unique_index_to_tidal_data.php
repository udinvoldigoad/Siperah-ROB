<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Index unik (station_code, recorded_at) agar impor pasang surut idempotent
     * (upsert) dan duplikasi timestamp tertolak di level database.
     */
    public function up(): void
    {
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS tidal_data_station_recorded_uidx ON tidal_data (station_code, recorded_at)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tidal_data_station_recorded_uidx');
    }
};
