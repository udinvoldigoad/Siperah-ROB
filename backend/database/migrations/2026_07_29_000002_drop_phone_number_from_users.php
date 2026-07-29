<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Buang kolom `users.phone_number`.
 *
 * Kolom ini punya aturan validasi di dua request, muncul di respons API, dan
 * diisi seeder - tapi TIDAK ADA satu pun form yang mengumpulkannya. Pencarian
 * `phone_number` di seluruh `frontend/src` menghasilkan nol kemunculan. Nomor
 * telepon sempat diwajibkan untuk pendaftaran peneliti lalu dicabut, dan
 * sisanya tertinggal sebagai permukaan mati.
 *
 * Aman dibuang: di produksi hanya 5 baris yang terisi, semuanya akun demo
 * `@siperah.local` dengan nomor placeholder dari seeder. Tak ada pengguna
 * sungguhan yang punya nomor.
 *
 * IDEMPOTEN - `database/schema.sql` sudah tidak lagi memuat kolom ini, jadi
 * pada database baru kolomnya memang tak pernah ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'phone_number')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('phone_number');
        });
    }

    /** Struktur bisa dikembalikan; isinya tidak - dan memang tak ada yang perlu. */
    public function down(): void
    {
        if (Schema::hasColumn('users', 'phone_number')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->string('phone_number', 30)->nullable()->after('password_hash');
        });
    }
};
