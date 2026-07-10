<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $sql = file_get_contents(base_path('../database/schema.sql'));
        $sql = str_replace('create extension if not exists postgis;', '', $sql);
        DB::unprepared($sql);
    }

    public function down(): void
    {
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
            DB::statement("drop table if exists {$table} cascade");
        }

        foreach ([
            'audit_outcome',
            'report_status',
            'report_severity',
            'risk_class',
            'user_status',
            'user_role',
        ] as $type) {
            DB::statement("drop type if exists {$type} cascade");
        }
    }
};
