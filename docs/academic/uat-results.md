# Hasil Pengujian Penerimaan Pengguna (User Acceptance Testing - UAT)

Dokumen ini mencatat skenario, ekspektasi, hasil aktual, dan status penerimaan dari pengujian UAT per peran (*role*) pada sistem SIPERAH-RoB. Seluruh skenario ini telah diuji secara otomatis menggunakan *E2E Test Suite (Playwright)* dan terisolasi menggunakan database pengujian khusus.

---

## 1. Modul: Warga & Mode Awam (`UAT-AWAM`)

### UAT-AWAM-01: Pemantauan Peta Publik & Filter Horizon
* **Skenario**: Membuka peta utama, memilih tanggal horizon H+7, mematikan layer "Laporan Warga".
* **Ekspektasi**: Peta memuat data zonasi risiko sesuai tanggal yang dipilih, layer laporan disembunyikan tanpa memicu error visual.
* **Hasil Aktual**: Layer ter-toggle dengan benar, respons data peta ter-load dalam ~300ms.
* **Status**: `[x] Lolos`

### UAT-AWAM-02: Deteksi Lokasi Mode Awam
* **Skenario**: Masuk ke Mode Awam, menekan tombol "Gunakan Lokasi Saya" dengan simulasi koordinat pesisir Panjang, Bandar Lampung.
* **Ekspektasi**: Sistem mendeteksi koordinat, menampilkan nama kelurahan "Panjang Utara", dan menampilkan status tingkat kerawanan rob.
* **Hasil Aktual**: Koordinat terdeteksi, nama kelurahan ter-resolve otomatis via PostGIS, status bahaya dan rekomendasi keselamatan muncul sesuai kelas risiko.
* **Status**: `[x] Lolos`

---

## 2. Modul: Pelaporan & Verifikasi Ground Truth (`UAT-GT`)

### UAT-GT-01: Pengiriman Laporan Baru oleh Warga
* **Skenario**: Login sebagai Warga, membuka wizard lapor, klik titik koordinat di peta, masukkan tinggi genangan 25cm, unggah 2 foto bukti WebP, kirim.
* **Ekspektasi**: Laporan tersimpan di database dengan status `menunggu`, foto terunggah di folder storage, dan warga menerima kode lacak laporan.
* **Hasil Aktual**: Laporan sukses terkirim, kode laporan acak dibuat, status antrean tercatat sebagai `menunggu`, tingkat kerawanan dihitung otomatis oleh server sebagai `Sedang` (batas 10-30cm).
* **Status**: `[x] Lolos`

### UAT-GT-02: Validasi Laporan oleh Operator BPBD
* **Skenario**: Login sebagai Operator BPBD, membuka dashboard antrean, melihat laporan dengan kode dari UAT-GT-01, meninjau detail foto, lalu klik "Validasi".
* **Ekspektasi**: Status laporan berubah menjadi `divalidasi`, nama operator terekam sebagai validator, laporan tampil di peta publik, dan aksi tercatat di audit log.
* **Hasil Aktual**: Laporan berhasil divalidasi, terhapus dari antrean menunggu operator, muncul di peta publik untuk seluruh pengguna, dan log audit `validate_report` terbuat sukses.
* **Status**: `[x] Lolos`

### UAT-GT-03: Penolakan Laporan oleh Operator BPBD
* **Skenario**: Login sebagai Operator BPBD, memilih laporan menunggu lainnya, klik "Tolak", masukkan alasan penolakan "Genangan disebabkan hujan deras lokal, bukan pasang surut", kirim.
* **Ekspektasi**: Status laporan berubah menjadi `ditolak`, alasan penolakan tersimpan, dan tidak muncul di peta publik.
* **Hasil Aktual**: Laporan ditolak sukses, alasan penolakan tersimpan di kolom `rejection_reason`, dan status log audit tercatat sukses.
* **Status**: `[x] Lolos`

---

## 3. Modul: Pemantauan Eksekutif Provinsi (`UAT-PROV`)

### UAT-PROV-01: Filter & Pengurutan Data Wilayah
* **Skenario**: Login sebagai BPBD Provinsi, membuka dashboard pemantauan, menyaring tabel berdasarkan Kabupaten Tanggamus, mengurutkan kelurahan berdasarkan "Populasi Berisiko".
* **Ekspektasi**: Tabel hanya menampilkan data kelurahan di Tanggamus dan terurut menurun berdasarkan jumlah populasi berisiko.
* **Hasil Aktual**: Data tersaring dan terurut secara reaktif via frontend, visualisasi grafik tren 30 hari ke depan ter-render sukses.
* **Status**: `[x] Lolos`

---

## 4. Modul: Portal Peneliti & API (`UAT-RES`)

### UAT-RES-01: Regenerasi API Key & Akses API v1
* **Skenario**: Login sebagai Peneliti, membuka halaman API, menekan tombol "Buat API Key Baru", lalu menggunakan kunci tersebut untuk melakukan GET request ke endpoint `/api/v1/predictions/daily`.
* **Ekspektasi**: Kunci baru ditampilkan di layar (sekali saja), kunci lama dicabut, dan GET request mengembalikan data prediksi JSON dengan status 200 OK.
* **Hasil Aktual**: API key baru berhasil di-generate, kunci lama langsung mengembalikan status 401 (Unauthorized) saat digunakan, dan kunci baru mengembalikan data prediksi JSON v1 valid dengan header `X-Api-Version: v1`.
* **Status**: `[x] Lolos`

---

## 5. Modul: Administrasi Sistem (`UAT-ADM`)

### UAT-ADM-01: Persetujuan Pengguna Baru & Edit Role Inline
* **Skenario**: Login sebagai Admin, meninjau pendaftaran baru operator BPBD, klik "Setujui". Kemudian, klik "Kelola" pada akun operator tersebut untuk mengubah wilayah tugasnya secara inline.
* **Ekspektasi**: Akun operator berubah status menjadi `aktif`, perubahan wilayah tersimpan di DB, dan operator dapat login ke dashboard wilayah tugas barunya.
* **Hasil Aktual**: Akun berhasil diaktifkan, perubahan data role/wilayah ter-update inline lewat UI, dan operator sukses masuk ke dashboard dengan batas wilayah barunya.
* **Status**: `[x] Lolos`
