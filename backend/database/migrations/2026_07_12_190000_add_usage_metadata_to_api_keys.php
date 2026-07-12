<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_keys', function (Blueprint $table): void {
            $table->jsonb('scopes')->default('["predictions:read","reports:read","tidal:read"]');
            $table->unsignedBigInteger('use_count')->default(0);
            $table->index(['key_hash', 'status'], 'api_keys_hash_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('api_keys', function (Blueprint $table): void {
            $table->dropIndex('api_keys_hash_status_idx');
            $table->dropColumn(['scopes', 'use_count']);
        });
    }
};
