# Panduan Pengguna (User Guide) - SIPERAH-RoB

Dokumen ini menjelaskan alur operasional utama dan fitur-fitur yang dapat diakses oleh masing-masing dari 5 peran (*roles*) pengguna dalam sistem SIPERAH-RoB.

---

## 1. Peran: Warga (Public & Terautentikasi)

### A. Memantau Risiko Pesisir & Pasang Surut
1. **Peta Publik**: Warga dapat membuka halaman utama peta publik tanpa login.
   * Gunakan tombol **Horizon Waktu** di atas peta untuk melihat proyeksi hari ini s.d. H+30.
   * Gunakan panel **Layer Control** untuk menampilkan/menyembunyikan Zona Bahaya, Laporan Warga, dan Data Pasang Surut BMKG.
   * Klik salah satu kelurahan untuk melihat pop-up detail tingkat risiko, populasi terdampak, dan grafik pasang surut.
2. **Mode Awam**: Warga dapat mengklik tab **Mode Awam** untuk memantau lokasi secara langsung:
   * Tekan tombol "Gunakan Lokasi Saya" (memerlukan izin GPS browser) atau cari nama kelurahan secara manual.
   * Sistem akan menampilkan ringkasan risiko dalam bahasa non-teknis ("Aman", "Siaga", "Bahaya Ekstrem") beserta rekomendasi tindakan keselamatan.

### B. Melaporkan Banjir Rob (Ground Truth)
1. Lakukan login terlebih dahulu menggunakan akun Warga terdaftar.
2. Buka menu **Lapor Kejadian Rob** (wizard 3 langkah):
   * **Langkah 1 (Lokasi)**: Klik peta pada titik persis terjadinya banjir rob.
   * **Langkah 2 (Detail)**: Masukkan tinggi air (dalam cm) dan deskripsi singkat kejadian. Sistem secara otomatis menghitung tingkat keparahan (Ringan/Sedang/Parah/Sangat Parah).
   * **Langkah 3 (Bukti Foto)**: Unggah maksimal 5 foto bukti fisik kejadian rob (maksimal 2MB per file, mendukung format JPG/PNG/WebP).
3. Setelah dikirim, Anda akan menerima **Kode Laporan** unik untuk menelusuri status validasi laporan Anda di tab **Riwayat Laporan Saya**.

---

## 2. Peran: Operator BPBD Kabupaten/Kota

### A. Mengelola Antrean Laporan Warga
1. Masuk ke **Dashboard Operator**.
2. Tab **Antrean Validasi** akan menampilkan seluruh laporan warga di wilayah kabupaten/kota kerja Anda yang berstatus `menunggu` atau `perlu_review`.
3. Klik tombol **Kelola** pada laporan untuk meninjau detail koordinat, deskripsi, dan foto bukti lapangan.
4. Klik aksi verifikasi:
   * **Validasi**: Laporan disetujui. Laporan langsung berubah status menjadi `divalidasi`, tercatat ke data *ground truth*, dan langsung muncul di peta publik.
   * **Tolak**: Masukkan alasan penolakan pada kolom alasan (mis. "Bukan banjir rob, melainkan genangan drainase").
   * **Duplikat**: Jika laporan merujuk pada kejadian dan titik yang sama yang sudah dilaporkan warga lain hari itu.

### B. Pemantauan Realtime & Status Wilayah
* Dashboard secara otomatis memperbarui angka KPI (laporan menunggu, kelurahan bahaya tinggi) setiap **30 detik** tanpa memuat ulang halaman.
* Jika ada laporan baru masuk, sistem memunculkan toast notifikasi mengambang.
* Tabel **Status Kelurahan** menampilkan daftar seluruh desa pesisir di bawah wewenang Anda, lengkap dengan status bahaya hari ini dan estimasi populasi terdampak.

---

## 3. Peran: BPBD Provinsi

### A. Tinjauan Eksekutif Tingkat Provinsi
1. Masuk ke **Dashboard Provinsi**.
2. Tinjau kartu KPI ringkasan tingkat provinsi (jumlah kabupaten terpantau, kelurahan terancam bahaya tinggi/sangat tinggi, dan total populasi berisiko).
3. Gunakan grafik **Tren Prediksi 30 Hari** untuk melihat proyeksi peningkatan jumlah kelurahan yang terancam bahaya kategori Tinggi/Sangat Tinggi selama sebulan ke depan (membantu perencanaan logistik).

### B. Analisis & Ekspor Data
* Tabel **Risiko per Kabupaten** dapat diurutkan secara interaktif dengan mengklik kolom (Bahaya Tertinggi, Populasi Berisiko, Tren, dll.).
* Gunakan filter periode (bulan berjalan) atau filter kabupaten di bagian atas untuk menyaring data.
* Klik tombol **Ekspor CSV** untuk mengunduh kompilasi data risiko bulanan tingkat provinsi untuk pelaporan dinas/gubernur.

---

## 4. Peran: Peneliti

### A. Mengunduh Dataset Historis
1. Masuk ke **Portal Peneliti**.
2. Tab **Unduh Dataset** menyediakan tiga dataset utama:
   * **Histori Prediksi ML**: Seluruh riwayat proyeksi probabilitas harian per kelurahan.
   * **Laporan Ground Truth Warga**: Rekaman koordinat kejadian banjir rob yang tervalidasi BPBD.
   * **Tinggi Muka Air Laut per Jam**: Data historis pasut dari stasiun pasut.
3. Anda dapat memfilter rentang tanggal, stasiun acuan, atau kabupaten sebelum menekan **Unduh (CSV / JSON)**.

### B. Integrasi API (API Key)
1. Buka tab **Kredensial API**.
2. Klik tombol **Buat API Key Baru** (atau *Regenerate Key* jika ingin mengganti kunci lama).
3. Salin API key rahasia yang muncul (`spr_xxx`). *Catatan: Kunci ini hanya ditampilkan sekali demi alasan keamanan.*
4. Gunakan API key tersebut pada header permintaan Anda (`X-API-Key` atau `Authorization`) untuk mengakses data secara terprogram (lihat petunjuk di tab **Referensi API**).

---

## 5. Peran: Administrator (Admin)

### A. Manajemen Pengguna & Verifikasi Akun Baru
1. Masuk ke **Menu Admin -> Pengguna**.
2. Permintaan pendaftaran akun baru dari operator BPBD atau peneliti akan masuk ke tab **Menunggu Persetujuan**. Klik **Setujui** atau **Tolak** akun tersebut.
3. Untuk pengguna aktif, Anda dapat melakukan **Edit Inline** secara langsung pada baris tabel:
   * Ubah Role (Warga, Operator, Provinsi, Peneliti, Admin).
   * Ubah wilayah kerja untuk Operator BPBD (masukkan UUID kelurahan terkait).
   * Ubah status akun (aktif/nonaktif). Nonaktifkan akun secara instan jika mendeteksi penyalahgunaan.

### B. Audit Log Sistem
1. Buka menu **Audit Log**.
2. Cari dan filter log aktivitas sistem berdasarkan Aktor, Jenis Aksi (login, logout, validasi laporan, ekspor data, perubahan role), Tanggal, atau Hasil Tindakan (Success/Fail/Denied).
3. Seluruh detail parameter data yang diubah terekam secara aman pada kolom payload JSON.
