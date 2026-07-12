<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table): void {
            $table->string('data_source', 100)->nullable();
            $table->text('source_reference')->nullable();
            $table->string('provenance_status', 20)->default('unverified');
        });
        Schema::table('predictions', function (Blueprint $table): void {
            $table->string('data_source', 100)->nullable();
            $table->text('source_reference')->nullable();
            $table->string('provenance_status', 20)->default('unverified');
        });
    }

    public function down(): void
    {
        Schema::table('predictions', fn (Blueprint $table) => $table->dropColumn(['data_source', 'source_reference', 'provenance_status']));
        Schema::table('regions', fn (Blueprint $table) => $table->dropColumn(['data_source', 'source_reference', 'provenance_status']));
    }
};
