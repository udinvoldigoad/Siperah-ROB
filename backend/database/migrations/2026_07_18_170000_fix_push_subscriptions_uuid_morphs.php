<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migration bawaan package memakai morphs() sehingga subscribable_id
     * bertipe BIGINT, padahal users.id kita UUID. Query WebPushChannel pun
     * error "invalid input syntax for bigint" dan membatalkan transaksi
     * (POST /reports jadi 500). Tabel masih baru dan subscription bersifat
     * ephemeral, jadi aman drop & recreate dengan uuidMorphs.
     */
    public function up(): void
    {
        $connection = config('webpush.database_connection');
        $table = config('webpush.table_name', 'push_subscriptions');

        Schema::connection($connection)->dropIfExists($table);
        Schema::connection($connection)->create($table, function (Blueprint $blueprint) {
            $blueprint->bigIncrements('id');
            $blueprint->uuidMorphs('subscribable', 'push_subscriptions_subscribable_morph_idx');
            $blueprint->string('endpoint', 500)->unique();
            $blueprint->string('public_key')->nullable();
            $blueprint->string('auth_token')->nullable();
            $blueprint->string('content_encoding')->nullable();
            $blueprint->timestamps();
        });
    }

    public function down(): void
    {
        $connection = config('webpush.database_connection');
        $table = config('webpush.table_name', 'push_subscriptions');

        Schema::connection($connection)->dropIfExists($table);
        Schema::connection($connection)->create($table, function (Blueprint $blueprint) {
            $blueprint->bigIncrements('id');
            $blueprint->morphs('subscribable', 'push_subscriptions_subscribable_morph_idx');
            $blueprint->string('endpoint', 500)->unique();
            $blueprint->string('public_key')->nullable();
            $blueprint->string('auth_token')->nullable();
            $blueprint->string('content_encoding')->nullable();
            $blueprint->timestamps();
        });
    }
};
