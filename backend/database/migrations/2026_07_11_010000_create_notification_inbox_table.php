<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS notification_inbox (
                id uuid PRIMARY KEY,
                user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type varchar(50) NOT NULL,
                title varchar(180) NOT NULL,
                body text NOT NULL,
                data jsonb NULL,
                read_at timestamp NULL,
                created_at timestamp NOT NULL DEFAULT now()
            )
        SQL);
        DB::statement('CREATE INDEX IF NOT EXISTS notification_inbox_user_created_idx ON notification_inbox (user_id, created_at DESC)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS notification_inbox');
    }
};
