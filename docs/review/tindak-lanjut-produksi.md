# 🔧 Tindak Lanjut Pasca-Audit — SIPERAH-RoB

> **Dibuat:** 2026-07-31 · Menggantikan `checklist-perbaikan.md` (dihapus).
> **Status audit:** 36/36 item di `checklist-perbaikan.md` sudah tuntas dan terverifikasi —
> `composer test` (202 OK), `pytest` ml-api (42 passed), `npm run build` + `check:any` (hijau).
> Satu-satunya pekerjaan tersisa bersifat **operasional di server produksi** (tidak bisa
> dieksekusi dari repo) — dicatat di bawah.

---

## 1. 🚨 Produksi — hapus akun demo `operator@` & `provinsi@` (sisa `DT-4`)

- [ ] 🟡 **`DT-4` — Akun demo `operator@` & `provinsi@` masih hidup di produksi** — *(bukti: produksi)*
  - `KM-2` sudah membuang kedua akun dari seeder/kode, tapi seeder memakai `updateOrInsert` —
    baris yang sudah ada di produksi **tidak ikut terhapus**.
  - Keduanya masih **aktif berperan `admin`** di produksi (login terakhir 28 & 27 Juli 2026),
    artinya kredensial demo ber-password `password` masih bisa masuk sebagai admin.
  - Pemeriksaan langsung ke DB produksi: tidak ada laporan, validasi, maupun kunci API —
    hanya 1 & 4 baris `audit_logs` dan 1 baris `notification_settings` masing-masing.

  **Langkah (jalankan di server produksi):**
  1. Pra-lihat — harus mencantumkan kedua akun:
     ```bash
     php artisan accounting:clean-demo --dry-run
     ```
  2. Jalankan penghapusan:
     ```bash
     php artisan accounting:clean-demo
     ```
  3. Verifikasi:
     ```bash
     php artisan tinker --execute="var_dump(\App\Models\User::whereIn('email', ['operator@siperah.local','provinsi@siperah.local'])->exists());"
     ```
     → `bool(false)`.

  **Perilaku command** (`backend/app/Console/Commands/CleanDemoAccounts.php`):
  `audit_logs.actor_user_id` di-null-kan lebih dulu (jejak audit tetap utuh, FK tak terputus),
  lalu `forceDelete()` — cascade menghapus `notification_settings` & `api_keys`. Aman untuk
  dijalankan ulang (no-op bila akun sudah tidak ada).

---

## 2. Catatan arsip

- Semua item audit lain (36/36) sudah tuntas — rincian lengkapnya ada di riwayat git
  `docs/review/checklist-perbaikan.md` (file dihapus 2026-07-31).
