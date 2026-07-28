<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Verifikasi email saat pendaftaran mandiri.
 *
 * Sebelum ini pendaftaran tidak memverifikasi apa pun: siapa saja bisa mengetik
 * alamat orang lain (atau salah ketik alamatnya sendiri) lalu langsung aktif.
 * Akibatnya reset kata sandi tak bisa diandalkan dan operator tak punya cara
 * menghubungi pelapor.
 */
return new class extends Migration
{
    /**
     * IDEMPOTEN — `database/schema.sql` sudah memuat kolom & tabel ini, jadi
     * pada database baru (`migrate:fresh`, CI, setup dev) keduanya sudah ada
     * sebelum migrasi berjalan. Tanpa penjagaan `hasColumn`/`hasTable`, migrasi
     * gagal dengan `42701 duplicate column` — jebakan yang sama persis dengan
     * migrasi penyederhanaan peran.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            });
        }

        // Backfill WAJIB: seluruh akun yang sudah ada dibuat sebelum verifikasi
        // diperkenalkan. Tanpa ini semuanya mendadak dianggap belum terverifikasi
        // dan terkunci dari login — termasuk admin.
        DB::table('users')->whereNull('email_verified_at')->update(['email_verified_at' => now()]);

        if (Schema::hasTable('email_verification_tokens')) {
            return;
        }

        // Tabel OTP terpisah dari `password_reset_tokens`: umur, kebijakan
        // percobaan, dan siklus hidupnya berbeda, dan mencampurnya membuat satu
        // permintaan reset bisa membatalkan verifikasi yang sedang berjalan.
        Schema::create('email_verification_tokens', function (Blueprint $table): void {
            $table->string('email')->primary();
            // Hanya hash yang disimpan — OTP plaintext tak pernah menyentuh DB
            // maupun log, sama seperti alur reset kata sandi.
            $table->string('token');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_verification_tokens');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('email_verified_at');
        });
    }
};
