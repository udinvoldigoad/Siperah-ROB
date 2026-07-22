# Panduan Operasional & Penanganan Insiden (Admin Runbook)

Dokumen ini panduan bagi administrator sistem untuk memantau kesehatan sistem, melakukan pencadangan data (*backup*), serta langkah taktis penanganan insiden (*incident response*).

---

## 1. Pemantauan Kesehatan Sistem (System Observability)
1. **Health Check Endpoint**: Panggil secara berkala `/up` pada domain produksi (mengembalikan status `200 OK` jika aplikasi Laravel dan database terhubung dengan aman).
2. **Command Health Check Terjadwal**: Command `system:health-check` berjalan setiap jam via scheduler Laravel. Perintah ini memeriksa:
   * Ada/tidaknya baris gagal di tabel `failed_jobs`.
   * Ada/tidaknya kesalahan dalam data import (`data_import_runs` status `failed`).
   * Ada/tidaknya error fatal baru di file log.
   Hasil audit otomatis ditulis ke log Laravel dengan tingkat `warning` agar tersimpan dalam log harian.
3. **Log File**: Berkas log harian tersimpan di server Hostinger pada path `backend/storage/logs/laravel-YYYY-MM-DD.log`.

---

## 2. Penanganan Insiden (Incident Response Runbooks)

### A. Insiden: API Down / Respons 500
* **Gejala**: Website tidak dapat dibuka atau memunculkan halaman kosong / respons API 500 Internal Server Error.
* **Langkah Penanganan**:
  1. Masuk ke server Hostinger via SSH, buka file log terbaru di `backend/storage/logs/laravel-YYYY-MM-DD.log`.
  2. Periksa apakah ada pesan error `Permission denied` atau `No space left on device` (kuota inode/storage Hostinger penuh).
  3. Jika konfigurasi tersangkut, bersihkan cache Laravel:
     ```bash
     /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan optimize:clear
     ```
  4. Jalankan ulang optimasi:
     ```bash
     /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan optimize
     ```

### B. Insiden: Koneksi Database Gagal (`Database Down`)
* **Gejala**: Log Laravel memunculkan `SQLSTATE[HY000] [2002] Connection refused` atau timeout koneksi Supabase.
* **Langkah Penanganan**:
  1. Buka status dashboard resmi Supabase untuk memeriksa apakah ada kendala regional pada server Singapura.
  2. Periksa apakah kuota koneksi database (*pooler limits*) terlampaui. Pastikan konfigurasi `.env` menggunakan port pooler yang tepat:
     * Port `5432` (Session Pooler) wajib digunakan untuk traffic normal web API Laravel.
  3. Uji koneksi database manual dari server Hostinger:
     ```bash
     /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan db:monitor
     ```

### C. Insiden: Sinkronisasi Data / Prediksi ML Gagal
* **Gejala**: Peta tidak ter-update hari ini, atau data pasang surut kosong.
* **Langkah Penanganan**:
  1. Periksa riwayat eksekusi di tabel `data_import_runs` untuk melihat ringkasan pesan error API BMKG/Open-Meteo:
     ```sql
     SELECT * FROM data_import_runs WHERE status = 'failed' ORDER BY started_at DESC LIMIT 5;
     ```
  2. Jika API BMKG/Open-Meteo sempat mengalami timeout, jalankan perintah sinkronisasi ulang secara manual via SSH:
     ```bash
     # Sinkronisasi data pasut
     /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan data:fetch-tidal-sealevel --days-back=3
     # Jalankan kalkulasi ML harian
     /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan ml:predict
     ```

### D. Insiden: Notifikasi Macet / Gagal Terkirim
* **Gejala**: Operator tidak menerima push notification, atau notifikasi riwayat laporan warga terlambat masuk.
* **Langkah Penanganan**:
  1. Periksa tabel `failed_jobs` untuk melihat tugas antrean notifikasi yang gagal:
     ```bash
     /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan queue:failed
     ```
  2. Baca detail kesalahan (kegagalan SMTP email, VAPID key expired, dll.) dari kolom exception.
  3. Setelah perbaikan (mis. perbaikan credentials SMTP), jalankan ulang antrean yang gagal:
     ```bash
     /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan queue:retry all
     ```

---

## 3. Strategi Pencadangan (Backup Policy)
1. **Pencadangan Database**: Rutin dijalankan otomatis setiap minggu menggunakan GitHub Actions di repositori private terpisah (`siperah-backups`) dengan perintah `pg_dump` versi 17. Berkas backup diunggah sebagai *build artifact* dengan retensi penyimpanan selama **90 hari**.
2. **Pencadangan File Gambar/Foto**: Foto laporan warga disimpan secara fisik di folder server Hostinger:
   `backend/storage/app/public/reports/`
   Lakukan pencadangan manual folder tersebut minimal sebulan sekali via SFTP atau perintah `rsync` dari folder server ke local storage BPBD.
