<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Samakan perilaku dengan notification_inbox & report_photos: saat user dihapus,
// api key dan pengaturan notifikasinya ikut terhapus (bukan RESTRICT/orphan).
// Query khusus PostgreSQL, sejalan keputusan "Postgres-required" (A16).
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey');
        DB::statement('ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');

        DB::statement('ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_user_id_fkey');
        DB::statement('ALTER TABLE notification_settings ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey');
        DB::statement('ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)');

        DB::statement('ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_user_id_fkey');
        DB::statement('ALTER TABLE notification_settings ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)');
    }
};
