<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Sederhanakan role dari 5 (warga, bpbd_operator, bpbd_provinsi, peneliti, admin)
     * menjadi 3 (warga, peneliti, admin).
     *
     * User lama dengan role bpbd_operator atau bpbd_provinsi otomatis dialihkan
     * ke role admin (sesuai konfirmasi pada 2026-07-28).
     *
     * PostgreSQL tidak mengizinkan ALTER TYPE...DROP VALUE, jadi enum-nya dibuat
     * ulang. URUTAN LANGKAHNYA PENTING: kolom dijadikan TEXT LEBIH DULU, baru
     * datanya dipetakan.
     *
     * Kenapa begitu: `database/schema.sql` sudah memuat enum versi 3 nilai,
     * sehingga pada database baru (`migrate:fresh`, CI, setup dev baru) label
     * 'bpbd_operator' TIDAK pernah ada. Melakukan UPDATE ... WHERE role IN
     * ('bpbd_operator', ...) selagi kolomnya masih bertipe enum membuat Postgres
     * menolak literalnya:
     *
     *     SQLSTATE[22P02]: invalid input value for enum user_role: "bpbd_operator"
     *
     * Setelah kolomnya TEXT, perbandingannya jadi perbandingan string biasa —
     * aman baik di database produksi (yang masih memuat nilai lama) maupun di
     * database baru (yang tidak).
     */
    public function up(): void
    {
        // 1. Lepas kolom dari enum lebih dulu supaya nilai lama bisa dipetakan
        //    tanpa divalidasi terhadap daftar label enum.
        DB::statement('ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::TEXT');

        // 2. Petakan role yang dihapus -> admin. No-op di database baru.
        DB::statement("UPDATE users SET role = 'admin' WHERE role IN ('bpbd_operator', 'bpbd_provinsi')");

        // 3. Buat ulang enum dengan daftar yang disederhanakan. CASCADE aman:
        //    users.role adalah satu-satunya pemakai tipe ini, dan saat ini sudah
        //    bertipe TEXT sehingga tak ada kolom yang ikut terhapus.
        DB::statement('DROP TYPE IF EXISTS user_role CASCADE');
        DB::statement("CREATE TYPE user_role AS ENUM ('warga', 'peneliti', 'admin')");

        // 4. Kembalikan kolom ke enum baru.
        DB::statement('ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role');
    }

    public function down(): void
    {
        // Kembalikan ke 5 role (tanpa bisa memulihkan data yang sudah diubah).
        DB::statement('ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::TEXT');
        DB::statement('DROP TYPE IF EXISTS user_role CASCADE');
        DB::statement("CREATE TYPE user_role AS ENUM ('warga', 'bpbd_operator', 'bpbd_provinsi', 'peneliti', 'admin')");
        DB::statement('ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role');
    }
};
