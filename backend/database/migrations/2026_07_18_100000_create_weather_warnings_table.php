<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weather_warnings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('regency', 100);
            $table->string('adm4_code', 20);
            $table->string('area_label', 150);          // kecamatan/desa yang jadi acuan
            $table->integer('weather_code');             // kode cuaca BMKG (95/97 petir, 65 lebat, dst)
            $table->string('weather_desc', 100);
            $table->string('severity', 20);              // sedang | tinggi
            $table->timestampTz('valid_from');
            $table->timestampTz('valid_until');
            $table->string('source', 60)->default('BMKG');
            $table->text('source_url')->nullable();
            $table->timestampTz('fetched_at');
            $table->timestampsTz();

            $table->index(['valid_until']);
            $table->index(['regency']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weather_warnings');
    }
};
