<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table): void {
            if (!Schema::hasColumn('regions', 'distance_to_coast_m')) {
                $table->decimal('distance_to_coast_m', 10, 2)->nullable();
            }
            if (!Schema::hasColumn('regions', 'avg_elevation_m')) {
                $table->decimal('avg_elevation_m', 8, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('regions', function (Blueprint $table): void {
            $table->dropColumn(['distance_to_coast_m', 'avg_elevation_m']);
        });
    }
};
