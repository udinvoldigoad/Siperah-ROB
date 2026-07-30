<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Hapus orphans yang user-nya sudah terhapus permanen
        DB::statement('DELETE FROM notification_settings WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.id = notification_settings.user_id)');
        DB::statement('DELETE FROM api_keys WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.id = api_keys.user_id)');
        // Hapus orphans yang user-nya di-soft delete
        DB::statement('DELETE FROM notification_settings WHERE user_id IN (SELECT id FROM users WHERE deleted_at IS NOT NULL)');
        DB::statement('DELETE FROM api_keys WHERE user_id IN (SELECT id FROM users WHERE deleted_at IS NOT NULL)');

        DB::statement('ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_user_id_fkey');
        DB::statement('ALTER TABLE notification_settings ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_user_id_fkey');
        DB::statement('ALTER TABLE notification_settings ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)');
    }
};
