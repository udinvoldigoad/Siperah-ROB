<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tidal_data', function (Blueprint $table): void {
            $table->string('data_type', 30)->default('timeseries');
            $table->string('datum', 20)->nullable();
            $table->string('event_type', 20)->nullable();
            $table->string('timezone', 50)->default('Asia/Jakarta');
            $table->text('source_reference')->nullable();
            $table->unique(
                ['station_code', 'recorded_at', 'data_type', 'datum'],
                'tidal_data_natural_key_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('tidal_data', function (Blueprint $table): void {
            $table->dropUnique('tidal_data_natural_key_unique');
            $table->dropColumn(['data_type', 'datum', 'event_type', 'timezone', 'source_reference']);
        });
    }
};
