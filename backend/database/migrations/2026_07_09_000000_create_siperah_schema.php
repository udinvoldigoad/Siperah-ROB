<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $sql = file_get_contents(base_path('../database/schema.sql'));
        DB::unprepared($sql);
    }

    public function down(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        foreach ([
            'audit_logs',
            'notification_settings',
            'api_keys',
            'datasets',
            'tidal_data',
            'report_photos',
            'ground_truth_reports',
            'predictions',
            'users',
            'regions',
        ] as $table) {
            DB::statement("DROP TABLE IF EXISTS {$table}");
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }
};
