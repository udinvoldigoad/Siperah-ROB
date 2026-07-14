<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('weather_data', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('region_id')->constrained('regions')->onDelete('cascade');
            $table->date('obs_date');
            $table->decimal('rainfall_mm', 6, 2)->nullable();
            $table->decimal('wind_speed_ms', 5, 2)->nullable();
            $table->string('wind_direction', 10)->nullable();
            $table->decimal('pressure_hpa', 6, 2)->nullable();
            $table->string('data_type', 20)->default('actual');
            $table->string('source', 50)->default('bmkg');
            $table->timestamps();

            $table->unique(['region_id', 'obs_date', 'data_type']);
        });

        Schema::create('climatology_monthly', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('region_id')->constrained('regions')->onDelete('cascade');
            $table->smallInteger('month');
            $table->decimal('avg_rainfall_mm', 6, 2)->nullable();
            $table->decimal('avg_wind_speed_ms', 5, 2)->nullable();
            $table->timestamps();

            $table->unique(['region_id', 'month']);
        });

        Schema::create('daily_features', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('region_id')->constrained('regions')->onDelete('cascade');
            $table->date('feature_date');
            $table->decimal('max_tide_height_cm', 6, 2)->nullable();
            $table->decimal('rainfall_mm', 6, 2)->nullable();
            $table->decimal('rainfall_3d_avg', 6, 2)->nullable();
            $table->decimal('rainfall_7d_avg', 6, 2)->nullable();
            $table->decimal('wind_speed_ms', 5, 2)->nullable();
            $table->decimal('pressure_hpa', 6, 2)->nullable();
            $table->smallInteger('month')->nullable();
            $table->boolean('is_full_moon_period')->nullable();
            $table->decimal('tide_x_rainfall', 10, 2)->nullable();
            $table->smallInteger('label_rob')->nullable();
            $table->timestamps();

            $table->unique(['region_id', 'feature_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_features');
        Schema::dropIfExists('climatology_monthly');
        Schema::dropIfExists('weather_data');
    }
};
