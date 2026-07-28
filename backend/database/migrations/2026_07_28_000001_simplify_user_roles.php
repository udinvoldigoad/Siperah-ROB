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
     * PostgreSQL tidak mengizinkan ALTER TYPE...DROP VALUE secara langsung,
     * sehingga kita harus membuat ulang enum dengan cara:
     * 1. Update data yang masih menggunakan nilai lama
     * 2. Ubah kolom ke TEXT
     * 3. Drop tipe enum lama
     * 4. Buat tipe enum baru dengan nilai yang disederhanakan
     * 5. Kembalikan kolom ke enum baru
     */
    public function up(): void
    {
        // Langkah 1: Migrasikan user dengan role yang akan dihapus -> admin
        DB::statement("UPDATE users SET role = 'admin' WHERE role IN ('bpbd_operator', 'bpbd_provinsi')");

        // Langkah 2: Ubah kolom ke TEXT sementara agar bisa drop enum lama
        DB::statement("ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::TEXT");

        // Langkah 3: Drop enum lama
        DB::statement("DROP TYPE IF EXISTS user_role CASCADE");

        // Langkah 4: Buat enum baru yang disederhanakan
        DB::statement("CREATE TYPE user_role AS ENUM ('warga', 'peneliti', 'admin')");

        // Langkah 5: Kembalikan kolom ke tipe enum baru
        DB::statement("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role");
    }

    public function down(): void
    {
        // Kembalikan ke 5 role (tanpa bisa memulihkan data yang sudah diubah)
        DB::statement("ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::TEXT");
        DB::statement("DROP TYPE IF EXISTS user_role CASCADE");
        DB::statement("CREATE TYPE user_role AS ENUM ('warga', 'bpbd_operator', 'bpbd_provinsi', 'peneliti', 'admin')");
        DB::statement("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role");
    }
};
