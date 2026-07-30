# 📘 Panduan Pengguna (User Guide) — SIPERAH-RoB v1.2.0

> **Sistem Informasi Prediksi Risiko Banjir Rob Terpadu Provinsi Lampung**

Dokumen ini menjelaskan secara lengkap cara menggunakan seluruh fitur dan modul dalam sistem SIPERAH-RoB. Panduan disusun berdasarkan **3 peran (role)** utama pengguna, beserta fitur-fitur publik yang dapat diakses tanpa login.

---

## Daftar Isi

1. [Pengantar Sistem](#1-pengantar-sistem)
2. [Persyaratan Akses](#2-persyaratan-akses)
3. [Registrasi & Login](#3-registrasi--login)
4. [Fitur Publik (Tanpa Login)](#4-fitur-publik-tanpa-login)
5. [Peran: Warga](#5-peran-warga)
6. [Peran: Peneliti](#6-peran-peneliti)
7. [Peran: Admin Sistem](#7-peran-admin-sistem)
8. [Pengaturan Notifikasi](#8-pengaturan-notifikasi)
9. [Klasifikasi Risiko & Keparahan](#9-klasifikasi-risiko--keparahan)
10. [FAQ (Pertanyaan Umum)](#10-faq-pertanyaan-umum)

---

## 1. Pengantar Sistem

SIPERAH-RoB adalah **Sistem Informasi Geografis (SIG)** berbasis WebGIS terpadu yang memanfaatkan kecerdasan buatan (*Machine Learning*) untuk memproyeksikan, memantau, dan memitigasi bencana banjir rob (genangan pasang air laut) di wilayah pesisir **Provinsi Lampung**.

### Fitur Utama

| Fitur | Deskripsi |
| :--- | :--- |
| 🗺️ **Peta Risiko Interaktif** | Visualisasi WebGIS zonasi bahaya rob 4 kelas per kelurahan dengan clustering berbasis MapLibre GL. |
| 📱 **Mode Awam** | Deteksi lokasi GPS otomatis untuk menampilkan ringkasan risiko dalam bahasa non-teknis secara instan. |
| 📸 **Pelaporan Ground Truth** | Pelaporan kejadian banjir rob terintegrasi dengan peta dan kompresi WebP gambar otomatis. |
| 📊 **Dashboard Operator & Provinsi** | Pemantauan *real-time* antrean laporan, KPI wilayah, dan tren prediksi 30 hari. |
| 🔬 **Portal Peneliti** | Unduh dataset historis dan integrasi API untuk keperluan riset akademik. |
| 🔔 **Notifikasi Multi-Kanal** | Alert via Email dan Push Browser dengan kustomisasi jenis event dan wilayah pantauan. |
| 🛡️ **Audit Log** | Pencatatan riwayat transaksi sensitif untuk transparansi dan keperluan audit. |

### Wilayah Cakupan

Sistem mencakup **15 kabupaten/kota pesisir** di Provinsi Lampung:

| No | Kabupaten/Kota |
| :--: | :--- |
| 1 | Kota Bandar Lampung |
| 2 | Kabupaten Lampung Selatan |
| 3 | Kabupaten Pesawaran |
| 4 | Kabupaten Tanggamus |
| 5 | Kabupaten Pesisir Barat |
| 6 | Kabupaten Lampung Timur |
| 7 | Kabupaten Tulang Bawang |
| 8 | Kabupaten Tulang Bawang Barat |
| 9 | Kabupaten Mesuji |
| 10 | Kabupaten Lampung Tengah |
| 11 | Kabupaten Lampung Utara |
| 12 | Kabupaten Way Kanan |
| 13 | Kabupaten Lampung Barat |
| 14 | Kabupaten Pringsewu |
| 15 | Kota Metro |

---

## 2. Persyaratan Akses

### Perangkat & Browser

- **Browser**: Google Chrome, Mozilla Firefox, Microsoft Edge, atau Safari versi terbaru.
- **Perangkat**: Dapat diakses dari komputer desktop, laptop, tablet, maupun smartphone.
- **Koneksi Internet**: Diperlukan koneksi internet yang stabil.
- **GPS** *(opsional)*: Untuk fitur Mode Awam dan penentuan lokasi otomatis pada pelaporan.

### Jenis Akun & Hak Akses

| Peran | Cara Mendapatkan Akun | Hak Akses |
| :--- | :--- | :--- |
| **Tamu** *(tanpa login)* | Tidak perlu registrasi | Peta publik, Mode Awam, halaman Panduan. |
| **Warga** | Registrasi mandiri (aktif setelah verifikasi email) | Semua fitur tamu + melapor kejadian rob + riwayat laporan. |
| **Peneliti** | Registrasi mandiri (memerlukan persetujuan admin) | Unduh dataset + integrasi API + riwayat laporan. |
| **Admin Sistem** | Dibuat oleh admin lain | Seluruh fitur sistem tanpa terkecuali. |

---

## 3. Registrasi & Login

### A. Registrasi Akun Baru

1. Buka halaman aplikasi SIPERAH-RoB.
2. Klik tombol **Masuk / Daftar** pada halaman portal utama.
3. Pada halaman login, klik tab **Daftar**.
4. Pilih jenis akun yang diinginkan:
   - **Warga**: Akun langsung aktif setelah verifikasi email.
   - **Peneliti**: Akun memerlukan persetujuan admin setelah verifikasi email.
5. Isi formulir pendaftaran:
   - **Nama Lengkap** — nama yang akan ditampilkan di sistem.
   - **Email** — harus email valid (digunakan untuk verifikasi OTP).
   - **Kata Sandi** — minimal 8 karakter.
   - **Institusi** *(khusus Peneliti)* — nama universitas/lembaga riset.
   - **Tujuan Penelitian** *(khusus Peneliti)* — deskripsi singkat tujuan penggunaan data.
6. Klik tombol **Daftar**.
7. Sistem akan mengirimkan **kode OTP 6 digit** ke email Anda.
8. Masukkan kode OTP pada halaman verifikasi. Kode berlaku selama **10 menit**.
   - Jika OTP kedaluwarsa, klik **Kirim Ulang Kode** (dibatasi 6 permintaan per menit).

> **Catatan untuk Peneliti**: Setelah verifikasi email berhasil, akun Anda akan berstatus **"Menunggu Persetujuan"**. Admin sistem akan meninjau permohonan Anda. Anda akan menerima notifikasi email saat akun disetujui.

### B. Login

1. Buka halaman login (`#/login`).
2. Masukkan **email** dan **kata sandi** yang terdaftar.
3. Klik tombol **Masuk**.
4. Setelah berhasil login, Anda akan diarahkan ke halaman default sesuai peran:
   - **Warga** → Peta Risiko (`#/map`)
   - **Peneliti** → Arsip Data (`#/research`)
   - **Admin** → Pengguna & Perizinan (`#/admin`)

### C. Login dengan Google

1. Pada halaman login, klik tombol **Masuk dengan Google**.
2. Pilih akun Google Anda dan berikan izin yang diperlukan.
3. Sistem akan otomatis membuat akun atau mencocokkan akun yang sudah ada.

### D. Lupa Kata Sandi

1. Pada halaman login, klik tautan **Lupa kata sandi?**.
2. Masukkan email yang terdaftar.
3. Sistem akan mengirimkan **kode OTP** ke email tersebut.
4. Masukkan kode OTP dan buat kata sandi baru.

---

## 4. Fitur Publik (Tanpa Login)

Fitur-fitur berikut dapat diakses oleh siapa saja **tanpa perlu registrasi atau login**.

### A. Peta Risiko Interaktif (`#/map`)

Peta publik menampilkan zonasi bahaya rob per kelurahan pesisir se-Provinsi Lampung.

#### Cara Menggunakan Peta

1. **Navigasi Peta**:
   - Gunakan *scroll* mouse / *pinch* layar sentuh untuk zoom in/out.
   - Klik dan seret untuk menggeser peta.
   - Klik pada kelurahan/desa untuk melihat pop-up detail.

2. **Horizon Waktu (Proyeksi Prediksi)**:
   - Gunakan tombol di bagian atas peta untuk memilih horizon waktu prediksi.
   - Opsi yang tersedia:

     | Tombol | Keterangan |
     | :--- | :--- |
     | **Hari ini** | Prakiraan risiko hari ini |
     | **+1 hari** | Prakiraan risiko besok |
     | **+2 hari** | Prakiraan risiko 2 hari ke depan |
     | **+3 hari** | Prakiraan risiko 3 hari ke depan |
     | **+7 hari** | Prakiraan risiko 7 hari ke depan |

3. **Layer Control (Kontrol Lapisan)**:
   - Klik ikon **Layer** (di pojok peta) untuk menampilkan/menyembunyikan lapisan:

     | Lapisan | Ikon | Deskripsi |
     | :--- | :---: | :--- |
     | Zona Bahaya Rob | 🔴🟠🟡🟢 | Pewarnaan kelurahan berdasarkan tingkat risiko. |
     | Laporan Warga | 📍 | Titik-titik lokasi laporan banjir rob yang tervalidasi. |
     | Pasang Surut | 🌊 | Posisi stasiun pengamatan pasang surut. |
     | Garis Pantai | 〰️ | Garis pantai Provinsi Lampung. |
     | Infrastruktur Kritis | 🏗️ | Lokasi infrastruktur penting di pesisir. |
     | Rute Evakuasi | 🛤️ | Jalur evakuasi yang tersedia. |

4. **Filter Kabupaten/Kota**:
   - Gunakan dropdown **Kabupaten** untuk memfokuskan peta ke wilayah tertentu.
   - Peta akan otomatis zoom ke area kabupaten yang dipilih.

5. **Pop-up Detail Kelurahan**:
   - Klik pada area kelurahan di peta.
   - Informasi yang ditampilkan:
     - Nama kelurahan, kecamatan, dan kabupaten.
     - Tingkat risiko (Rendah / Sedang / Tinggi / Sangat Tinggi).
     - Persentase probabilitas risiko.
     - Estimasi populasi terdampak.
     - Grafik prakiraan pasang surut.
     - Skor kepercayaan model (*confidence score*).

6. **Peringatan Aktif**:
   - Jika ada peringatan cuaca/pasang ekstrem, banner peringatan akan muncul di bagian atas peta.
   - Banner menampilkan judul peringatan, pesan detail, dan daftar kabupaten terdampak.

> **Catatan tentang Klaster Peta**: Lingkaran klaster pada peta menampilkan **rata-rata persentase probabilitas** wilayah, namun diwarnai berdasarkan **risiko tertinggi** (`maxRank`) desa di dalamnya. Ini bertujuan memicu kewaspadaan dini sebelum pengguna melakukan *zoom-in* ke level kelurahan.

### B. Mode Awam (`#/awam`)

Mode Awam dirancang untuk menyajikan informasi risiko banjir rob dalam **bahasa sederhana dan non-teknis**, sehingga mudah dipahami oleh warga umum.

#### Cara Menggunakan

1. Buka menu **Mode Awam** dari navigasi samping.
2. Tentukan lokasi Anda dengan salah satu cara:
   - **🎯 Gunakan Lokasi Saya**: Klik tombol ini untuk mendeteksi posisi GPS perangkat secara otomatis (memerlukan izin akses lokasi dari browser).
   - **🔍 Cari Wilayah**: Ketik nama kelurahan/kecamatan/kabupaten pada kolom pencarian, lalu pilih dari daftar yang muncul.
3. Sistem akan menampilkan **kartu risiko** dengan informasi:
   - **Status Risiko**: Ditampilkan dalam bahasa sederhana:

     | Status | Warna Kartu | Makna |
     | :--- | :---: | :--- |
     | **Aman** | 🔵 Biru | Risiko rendah, tidak ada ancaman signifikan. |
     | **Waspada** | 🟡 Kuning | Risiko sedang, pantau perkembangan kondisi. |
     | **Siaga** | 🟠 Oranye | Risiko tinggi, bersiap dan waspada terhadap potensi rob. |
     | **Bahaya Ekstrem** | 🔴 Merah | Risiko sangat tinggi, segera ikuti arahan evakuasi. |

   - **Pesan Panduan**: Rekomendasi tindakan keselamatan sesuai level risiko.
   - **Tinggi Muka Air Laut Maksimum**: Estimasi ketinggian pasang tertinggi.
   - **Waktu Puncak Pasang**: Prakiraan jam puncak pasang air laut.
4. **Prakiraan 7 Hari ke Depan**: Di bawah kartu utama, terdapat timeline prakiraan harian yang menunjukkan tren risiko.
5. **Laporan Terdekat**: Jika ada laporan kejadian rob tervalidasi di sekitar lokasi Anda, sistem akan menampilkan daftarnya beserta waktu kejadian dan tingkat keparahan.

### C. Halaman Panduan (`#/onboarding`)

Halaman panduan interaktif yang menjelaskan cara menggunakan SIPERAH-RoB. Berisi:

- Penjelasan cara membaca peta risiko.
- Panduan melapor kejadian banjir rob.
- FAQ (Pertanyaan yang Sering Diajukan).
- Statistik prediksi terkini dan kelurahan berisiko tinggi.

---

## 5. Peran: Warga

Pengguna dengan peran **Warga** memiliki seluruh hak akses fitur publik, ditambah kemampuan **melapor kejadian banjir rob** dan **menelusuri riwayat laporan** miliknya.

### Menu Navigasi Warga

| Menu | Rute | Deskripsi |
| :--- | :--- | :--- |
| 🗺️ Peta Risiko | `#/map` | Peta interaktif zonasi bahaya rob. |
| 📱 Mode Awam | `#/awam` | Cek risiko lokasi dalam bahasa sederhana. |
| ❓ Panduan | `#/onboarding` | Halaman panduan penggunaan sistem. |
| 📝 Lapor | `#/reports` | Formulir pelaporan kejadian banjir rob. |
| 📋 Riwayat Laporan | `#/history` | Daftar riwayat laporan yang pernah dikirim. |

### A. Melaporkan Banjir Rob (Ground Truth)

Pelaporan menggunakan **wizard 3 langkah** yang memandu Anda secara bertahap:

#### Langkah 1 — Lokasi & Waktu

1. Buka menu **Lapor** (`#/reports`).
2. **Tentukan lokasi kejadian** dengan salah satu cara:
   - Klik langsung pada peta di titik persis lokasi banjir rob terjadi.
   - Peta akan menampilkan marker di posisi yang Anda klik.
3. Sistem secara otomatis mendeteksi **kelurahan/kecamatan/kabupaten** dari koordinat yang dipilih (reverse geocoding).
4. **Waktu Kejadian**: Isi waktu perkiraan kejadian banjir rob. Default-nya adalah waktu saat ini.
   - Format: `HH:MM` (jam 24 jam).
   - Jika waktu yang diisi lebih dari waktu sekarang, sistem otomatis menganggap kejadian terjadi hari sebelumnya.

> **Peringatan**: Jika lokasi yang Anda pilih berada **di luar area pesisir yang dipantau**, sistem akan menampilkan peringatan. Laporan tetap dapat dikirim, tetapi mungkin tidak muncul di peta publik.

#### Langkah 2 — Detail Kejadian

1. **Tinggi Air (cm)**: Masukkan estimasi ketinggian genangan air rob dalam sentimeter.
   - Sistem otomatis menghitung tingkat keparahan berdasarkan tinggi air:

     | Tinggi Air | Keparahan |
     | :--- | :--- |
     | < 10 cm | 🟢 **Ringan** |
     | 10–30 cm | 🟡 **Sedang** |
     | 31–80 cm | 🟠 **Parah** |
     | > 80 cm | 🔴 **Sangat Parah** |

   - Anda juga dapat memilih tingkat keparahan secara manual melalui kartu pilihan.
2. **Deskripsi Kejadian**: Jelaskan kondisi yang Anda amati secara singkat (wajib diisi).

#### Langkah 3 — Bukti Foto

1. **Unggah Foto**: Klik area unggah atau seret file foto ke dalamnya.
   - Maksimal **5 foto** per laporan.
   - Ukuran maksimal **2 MB** per foto.
   - Format yang didukung: **JPG, PNG, WebP**.
   - Foto akan **otomatis dikompres ke format WebP** di sisi browser untuk menghemat bandwidth (resolusi maksimal 1600px).
2. Pratinjau foto akan ditampilkan beserta ukuran file. Klik ikon ❌ untuk menghapus foto yang tidak diinginkan.
3. Klik **Kirim Laporan** untuk menyelesaikan pelaporan.

#### Setelah Laporan Terkirim

- Anda akan menerima **Kode Laporan** unik (format: `ROB-XXXXXXXX`).
- Simpan kode ini untuk menelusuri status validasi laporan Anda.
- Status awal laporan: **Menunggu** *(menunggu validasi operator BPBD)*.

### B. Menelusuri Riwayat Laporan (`#/history`)

1. Buka menu **Riwayat Laporan**.
2. Daftar seluruh laporan yang pernah Anda kirim ditampilkan, termasuk:
   - **Kode Laporan** — identifikasi unik.
   - **Tanggal & Waktu Kejadian**.
   - **Lokasi** — kelurahan/kecamatan/kabupaten.
   - **Tingkat Keparahan** — Ringan/Sedang/Parah/Sangat Parah.
   - **Status Validasi**:

     | Status | Badge | Arti |
     | :--- | :---: | :--- |
     | `menunggu` | 🟡 | Belum ditinjau operator. |
     | `perlu_review` | 🟠 | Ditandai untuk ditinjau ulang. |
     | `divalidasi` | 🟢 | Disetujui oleh operator, data masuk ke ground truth. |
     | `ditolak` | 🔴 | Ditolak beserta alasan penolakan. |
     | `duplikat` | ⚪ | Sudah ada laporan serupa untuk kejadian yang sama. |

---

## 6. Peran: Peneliti

Pengguna dengan peran **Peneliti** memiliki akses ke **Portal Peneliti** untuk mengunduh dataset historis dan menggunakan API data secara terprogram.

### Menu Navigasi Peneliti

| Menu | Rute | Deskripsi |
| :--- | :--- | :--- |
| 🗺️ Peta Risiko | `#/map` | Peta interaktif zonasi bahaya rob. |
| 📋 Riwayat Laporan | `#/history` | Daftar laporan yang pernah dikirim. |
| 🔬 Arsip Data | `#/research` | Portal unduh dataset dan manajemen API. |

### A. Mengunduh Dataset Historis

1. Buka menu **Arsip Data** (`#/research`).
2. Tab **Katalog Dataset** menampilkan seluruh dataset yang tersedia:

   | Dataset | Deskripsi |
   | :--- | :--- |
   | **Histori Prediksi ML** | Seluruh riwayat proyeksi probabilitas harian per kelurahan. |
   | **Laporan Ground Truth Warga** | Rekaman koordinat kejadian banjir rob yang tervalidasi BPBD. |
   | **Tinggi Muka Air Laut per Jam** | Data historis pasang surut dari stasiun pengamatan. |

3. Untuk setiap dataset, informasi yang ditampilkan:
   - Nama dan deskripsi dataset.
   - Tipe dataset (*prediction*, *ground_truth*, *tidal*).
   - Periode data (tanggal awal – akhir).
   - Resolusi (*harian*, *per jam*).
   - Jumlah rekaman (record count).
   - Lisensi penggunaan data.
   - Cakupan kabupaten.

4. **Filter Dataset**:
   - Gunakan filter **Kabupaten** untuk menyaring dataset berdasarkan wilayah.
   - Gunakan tombol **paginasi** jika dataset berjumlah banyak.

5. Klik tombol **Unduh CSV** atau **Unduh JSON** pada dataset yang diinginkan.
   - File akan diunduh langsung ke perangkat Anda.

### B. Statistik Penggunaan

Di bagian atas portal, terdapat kartu statistik ringkasan:

| Metrik | Keterangan |
| :--- | :--- |
| **Jumlah Dataset** | Total dataset yang tersedia untuk diunduh. |
| **Total Rekaman** | Jumlah keseluruhan baris data di semua dataset. |
| **Unduhan Bulan Ini** | Jumlah unduhan yang Anda lakukan bulan berjalan. |
| **Panggilan API Hari Ini** | Jumlah panggilan API yang Anda lakukan hari ini. |

### C. Integrasi API (API Key)

Peneliti dapat mengakses data secara terprogram melalui REST API.

#### Alur Pengajuan Akses API

1. Buka tab **Kredensial API** pada halaman Arsip Data.
2. Jika ini pertama kali, Anda perlu **Mengajukan Permohonan Akses API**:
   - Isi formulir permohonan:
     - **Tujuan Penggunaan** — jelaskan untuk apa API akan digunakan.
     - **Organisasi/Institusi** — nama lembaga Anda.
     - **Judul Proyek** — judul riset/proyek.
   - Klik **Ajukan Permohonan**.
   - Permohonan akan ditinjau oleh admin sistem.
3. Setelah permohonan **disetujui**, Anda dapat membuat API Key:
   - Klik tombol **Buat API Key Baru** (atau **Regenerasi Key** untuk mengganti key lama).
   - **API Key rahasia** (`spr_xxxx...`) akan ditampilkan **hanya sekali**. Salin dan simpan segera.

#### Cara Menggunakan API Key

Gunakan API Key pada header HTTP permintaan Anda:

```
X-API-Key: spr_xxxx...
```

atau

```
Authorization: Bearer spr_xxxx...
```

#### Endpoint API v1 yang Tersedia

| Method | Endpoint | Deskripsi | Izin |
| :---: | :--- | :--- | :--- |
| `GET` | `/api/v1/predictions/daily` | Prediksi harian per kelurahan. | `predictions:read` |
| `GET` | `/api/v1/reports` | Laporan ground truth tervalidasi. | `reports:read` |
| `GET` | `/api/v1/tidal` | Data pasang surut historis. | `tidal:read` |

> **Rate Limit**: Setiap API Key memiliki batasan jumlah panggilan per periode (rate limiting). Pastikan menggunakan API secara bertanggung jawab.

### D. Referensi API

Tab **Referensi API** pada halaman Arsip Data menyediakan dokumentasi lengkap endpoint, parameter query, dan contoh respons JSON untuk mempermudah integrasi.

---

## 7. Peran: Admin Sistem

Admin Sistem memiliki **akses penuh ke seluruh fitur** dalam SIPERAH-RoB, termasuk kemampuan mengelola pengguna, memvalidasi laporan, dan memantau seluruh wilayah provinsi.

### Menu Navigasi Admin

| Menu | Rute | Deskripsi |
| :--- | :--- | :--- |
| 🗺️ Peta Risiko | `#/map` | Peta interaktif zonasi bahaya rob. |
| 📱 Mode Awam | `#/awam` | Cek risiko lokasi dalam bahasa sederhana. |
| ❓ Panduan | `#/onboarding` | Halaman panduan penggunaan sistem. |
| 📝 Lapor | `#/reports` | Formulir pelaporan kejadian banjir rob. |
| 📋 Riwayat Laporan | `#/history` | Daftar riwayat laporan. |
| ✅ Operator | `#/operator` | Dashboard operator — validasi laporan warga. |
| 📈 Pantauan Provinsi | `#/province` | Dashboard eksekutif tingkat provinsi. |
| 🔬 Arsip Data | `#/research` | Portal unduh dataset dan manajemen API. |
| 👤 Pengguna & Perizinan | `#/admin` | Manajemen pengguna dan permohonan akses. |
| 🛡️ Audit | `#/audit` | Log audit aktivitas sistem. |

---

### A. Dashboard Operator BPBD (`#/operator`)

Dashboard operator dirancang untuk **mengelola antrean laporan warga** dan **memantau status wilayah** pesisir secara real-time.

#### Kartu KPI (Key Performance Indicators)

Di bagian atas dashboard, terdapat 4 kartu metrik utama:

| Metrik | Deskripsi |
| :--- | :--- |
| **Kelurahan Terpantau** | Jumlah total desa pesisir dalam wilayah kerja. |
| **Kelurahan Kritis** | Jumlah kelurahan yang berstatus bahaya tinggi/sangat tinggi hari ini. |
| **Laporan Menunggu** | Jumlah laporan warga yang belum divalidasi. |
| **Validasi Bulan Ini** | Jumlah laporan yang sudah diproses bulan berjalan. |

> **Auto-refresh**: Dashboard memperbarui data KPI secara otomatis setiap **30 detik** tanpa memuat ulang halaman. Jika ada laporan baru masuk, *toast notification* akan muncul.

#### Mengelola Antrean Laporan

1. Tab **Antrean** menampilkan seluruh laporan warga yang berstatus `menunggu` atau `perlu_review`.
2. Untuk setiap laporan, ditampilkan:
   - Kode laporan, nama pelapor, waktu kejadian.
   - Tingkat keparahan (Ringan/Sedang/Parah/Sangat Parah).
   - Foto bukti lapangan (jika ada).
   - Lokasi pada peta mini.
3. **Filter & Sortir**:
   - Filter berdasarkan **tingkat keparahan** (Ringan, Sedang, Parah, Sangat Parah).
   - Filter laporan yang **melewati SLA** (tenggat waktu validasi).
4. Klik tombol **Kelola** pada laporan untuk membuka detail lengkap.
5. Pilih salah satu tindakan:

   | Aksi | Efek |
   | :--- | :--- |
   | ✅ **Validasi** | Laporan disetujui. Status berubah menjadi `divalidasi`, data masuk ke *ground truth*, dan langsung muncul di peta publik. |
   | ❌ **Tolak** | Laporan ditolak. Wajib mengisi **alasan penolakan** (mis. "Bukan banjir rob, melainkan genangan drainase"). |
   | 📋 **Duplikat** | Laporan ditandai sebagai duplikat dari laporan lain pada kejadian dan lokasi yang sama. |

6. Tab **Riwayat** menampilkan seluruh laporan yang sudah diproses (`divalidasi` atau `ditolak`).

#### Ekspor Laporan

- Klik tombol **Ekspor CSV** untuk mengunduh data laporan dalam format CSV.
- Data yang diekspor mencakup seluruh kolom laporan termasuk koordinat, keparahan, dan status validasi.

#### Tabel Status Kelurahan

Di bagian bawah dashboard, tabel **Status Kelurahan** menampilkan:

| Kolom | Deskripsi |
| :--- | :--- |
| Kelurahan | Nama desa/kelurahan pesisir. |
| Kecamatan | Nama kecamatan. |
| Kabupaten | Nama kabupaten/kota. |
| Populasi | Estimasi jumlah penduduk. |
| Tingkat Risiko | Status bahaya hari ini (Rendah/Sedang/Tinggi/Sangat Tinggi). |
| Probabilitas | Persentase probabilitas risiko. |

---

### B. Dashboard Provinsi (`#/province`)

Dashboard eksekutif tingkat provinsi menyediakan **pandangan menyeluruh** terhadap kondisi risiko banjir rob di seluruh Provinsi Lampung.

#### Kartu KPI Provinsi

| Metrik | Deskripsi |
| :--- | :--- |
| **Kabupaten Terpantau** | Jumlah total kabupaten/kota yang tercakup dalam sistem. |
| **Kelurahan Bahaya Tinggi** | Jumlah kelurahan berstatus Tinggi atau Sangat Tinggi hari ini. |
| **Populasi Berisiko** | Total estimasi penduduk di kelurahan bahaya tinggi/sangat tinggi. |
| **Validasi Laporan Bulan Ini** | Total laporan warga yang tervalidasi bulan berjalan. |

#### Grafik Tren Prediksi 30 Hari

- Grafik garis yang menampilkan **tren jumlah kelurahan bahaya tinggi/sangat tinggi** selama 30 hari ke depan.
- Membantu perencanaan logistik dan mitigasi jangka menengah.
- Garis menunjukkan:
  - **Rata-rata probabilitas** per hari.
  - **Probabilitas maksimum** per hari.
  - **Jumlah kelurahan kritis** per hari.

#### Tabel Risiko per Kabupaten

Tabel interaktif yang menampilkan ringkasan per kabupaten/kota:

| Kolom | Deskripsi |
| :--- | :--- |
| Kabupaten | Nama kabupaten/kota. |
| Rendah | Jumlah kelurahan risiko rendah. |
| Sedang | Jumlah kelurahan risiko sedang. |
| Tinggi | Jumlah kelurahan risiko tinggi. |
| Sangat Tinggi | Jumlah kelurahan risiko sangat tinggi. |
| Populasi Berisiko | Estimasi total penduduk terdampak. |
| Probabilitas Maks | Probabilitas tertinggi di kabupaten tsb. |
| Tren | Perubahan dibanding periode sebelumnya (↑ naik / ↓ turun / ─ stabil). |

- Tabel dapat **diurutkan** dengan mengklik header kolom.
- Gunakan **filter kabupaten** atau **filter bulan** di bagian atas untuk menyaring data.

#### Tabel Kelurahan Terdampak Tertinggi (Top Impacted)

Menampilkan daftar kelurahan dengan skor risiko tertinggi, lengkap dengan:
- Probabilitas risiko.
- Kelas risiko.
- Estimasi populasi terdampak beserta sumber data populasi.
- Ketinggian pasang maksimum.

#### Ekspor Data Provinsi

- Klik tombol **Ekspor CSV** untuk mengunduh kompilasi data risiko tingkat provinsi.
- Data cocok untuk pelaporan ke dinas/gubernur.

---

### C. Manajemen Pengguna & Perizinan (`#/admin`)

Halaman ini memungkinkan admin untuk mengelola seluruh akun pengguna dalam sistem.

#### Kartu Ringkasan Pengguna

| Metrik | Deskripsi |
| :--- | :--- |
| Total Pengguna | Jumlah keseluruhan akun terdaftar. |
| Aktif | Jumlah akun berstatus aktif. |
| Menunggu | Jumlah akun yang menunggu persetujuan. |
| Nonaktif | Jumlah akun yang telah dinonaktifkan. |
| Peneliti Menunggu | Jumlah permohonan akun peneliti yang belum ditinjau. |

#### Mengelola Akun Pengguna

1. **Tabel Pengguna**: Menampilkan daftar seluruh pengguna dengan kolom:
   - Nama, email, peran, status, institusi, wilayah kerja, tanggal registrasi.
2. **Filter & Cari**:
   - Cari berdasarkan nama atau email.
   - Filter berdasarkan peran (Warga, Peneliti, Admin).
   - Filter berdasarkan status (Aktif, Menunggu, Nonaktif, Ditolak).
3. **Aksi per Pengguna**:

   | Aksi | Deskripsi |
   | :--- | :--- |
   | ✅ **Setujui** | Menyetujui akun yang berstatus `menunggu` (khususnya akun peneliti). |
   | ❌ **Tolak** | Menolak permohonan akun. |
   | ✏️ **Edit** | Mengubah data pengguna secara *inline* langsung pada tabel: |
   |  | • **Peran**: Warga → Peneliti → Admin (dan sebaliknya). |
   |  | • **Status**: Aktif ↔ Nonaktif (nonaktifkan akun secara instan). |
   |  | • **Wilayah Kerja**: Menetapkan wilayah untuk operator. |
   | 🗑️ **Hapus** | Menghapus akun secara permanen. |

4. **Membuat Pengguna Baru**:
   - Klik tombol **Tambah Pengguna**.
   - Isi nama, email, kata sandi, peran, dan wilayah kerja (jika diperlukan).
   - Akun yang dibuat admin langsung berstatus aktif.

5. **Ekspor Pengguna**: Klik **Ekspor CSV** untuk mengunduh daftar pengguna.

#### Mengelola Permohonan Akses API

1. Tab **Permohonan Akses API** menampilkan daftar permohonan dari peneliti.
2. Untuk setiap permohonan, terdapat informasi:
   - Nama peneliti dan institusi.
   - Tujuan penggunaan dan judul proyek.
   - Tanggal permohonan.
3. Klik **Setujui** atau **Tolak** (dengan alasan) untuk memproses permohonan.

---

### D. Audit Log Sistem (`#/audit`)

Log audit mencatat seluruh aktivitas sensitif dalam sistem untuk keperluan transparansi dan keamanan.

#### Cara Menggunakan

1. Buka menu **Audit** (`#/audit`).
2. **Kartu Ringkasan** di bagian atas menampilkan:
   - Total log, jumlah Berhasil, Ditolak, Gagal, dan Sebagian.
3. **Tabel Log Audit** menampilkan:

   | Kolom | Deskripsi |
   | :--- | :--- |
   | Waktu | Tanggal dan jam aktivitas terjadi. |
   | Aktor | Nama dan peran pengguna yang melakukan aksi. |
   | Aksi | Jenis tindakan (login, validasi, ekspor, ubah role, dll.). |
   | Target | Resource yang terdampak. |
   | Hasil | Berhasil / Gagal / Ditolak / Sebagian. |
   | IP | Alamat IP pengguna. |
   | Payload | Detail parameter data yang diubah (format JSON). |

4. **Filter & Cari**:
   - Filter berdasarkan **Hasil** (Berhasil, Gagal, Ditolak, Sebagian).
   - Filter berdasarkan **Jenis Aksi** (login, logout, validasi_laporan, ekspor_data, ubah_role, dll.).
   - Filter berdasarkan **rentang tanggal**.
   - Cari berdasarkan nama aktor.

5. **Ekspor Log**: Unduh log audit dalam format CSV.

---

## 8. Pengaturan Notifikasi

Setiap pengguna yang login dapat mengkustomisasi **preferensi notifikasi** melalui halaman Pengaturan Notifikasi (`#/notifications`).

### Kanal Notifikasi

| Kanal | Deskripsi |
| :--- | :--- |
| 🔔 **Browser (Push)** | Notifikasi push langsung di browser (memerlukan izin browser). |
| 📧 **Email** | Notifikasi dikirim ke email terdaftar. |

### Jenis Event yang Dapat Dipantau

| Event | Deskripsi |
| :--- | :--- |
| 🔴 **Bahaya Sangat Tinggi** | Saat ada kelurahan mencapai level risiko Sangat Tinggi. |
| 📸 **Laporan Ground Truth** | Saat ada laporan baru dari warga di wilayah pantauan. |
| 🔄 **Pembaruan Model** | Saat model ML diperbarui atau prediksi harian selesai dijalankan. |
| 📊 **Ringkasan Harian** | Rangkuman kondisi risiko harian untuk wilayah pantauan. |
| ⚠️ **Peringatan BMKG** | Saat ada peringatan cuaca/pasang ekstrem dari BMKG. |

### Wilayah Pantauan

- Anda dapat menambahkan **kabupaten/kota** tertentu sebagai wilayah yang ingin dipantau.
- Notifikasi hanya akan dikirim untuk event yang terjadi di wilayah yang Anda pilih.
- Kabupaten yang tersedia:
  - Bandar Lampung, Lampung Selatan, Pesawaran, Tanggamus, Pesisir Barat, Lampung Timur, Tulang Bawang.

### Cara Mengatur

1. Buka menu profil → **Pengaturan Notifikasi** (`#/notifications`).
2. Centang kanal notifikasi yang diinginkan (Browser / Email).
3. Centang jenis event yang ingin dipantau.
4. Tambahkan wilayah pantauan dengan mengklik **Tambah Wilayah** dan memilih kabupaten dari dropdown.
5. Klik **Simpan Pengaturan**.

> **Push Browser**: Saat mengaktifkan notifikasi browser untuk pertama kali, browser akan meminta izin "Izinkan Notifikasi". Klik **Izinkan** agar push notification dapat diterima.

---

## 9. Klasifikasi Risiko & Keparahan

### Kelas Risiko Banjir Rob (Prediksi ML)

Kelas risiko dihasilkan oleh model **Random Forest Classifier** yang dijalankan setiap hari:

| Kelas | Warna | Keterangan |
| :---: | :---: | :--- |
| **Rendah** | 🟢 `#16a34a` | Probabilitas rendah, tidak ada indikasi ancaman rob signifikan. |
| **Sedang** | 🟡 `#d97706` | Probabilitas moderat, perlu memantau perkembangan pasang surut. |
| **Tinggi** | 🟠 `#f4510b` | Probabilitas tinggi, siaga terhadap potensi genangan rob. |
| **Sangat Tinggi** | 🔴 `#e52421` | Probabilitas sangat tinggi, ancaman rob serius — siapkan mitigasi. |

### Tingkat Keparahan Laporan (Ground Truth)

Tingkat keparahan ditentukan berdasarkan **tinggi genangan air** yang dilaporkan warga:

| Keparahan | Tinggi Air | Warna |
| :--- | :--- | :---: |
| **Ringan** | < 10 cm | 🟢 `#16a34a` |
| **Sedang** | 10–30 cm | 🟡 `#d97706` |
| **Parah** | 31–80 cm | 🟠 `#ea580c` |
| **Sangat Parah** | > 80 cm | 🔴 `#dc2626` |

---

## 10. FAQ (Pertanyaan Umum)

### Umum

**Q: Seberapa akurat prediksi banjir rob SIPERAH-RoB?**
> Prediksi adalah alat kewaspadaan, **bukan kepastian kejadian**. Gunakan informasi risiko bersama arahan resmi BPBD dan kondisi nyata di lapangan.

**Q: Data apa yang digunakan model prediksi?**
> Model memadukan: (1) data cuaca dan gelombang laut historis dari Open-Meteo (reanalisis ERA5), (2) proyeksi pasang surut berbasis model harmonik per stasiun, (3) faktor spasial elevasi & jarak ke pantai per kelurahan, (4) kejadian rob riil (BNPB DIBI), serta (5) laporan lapangan warga yang telah divalidasi BPBD.

**Q: Siapa saja yang bisa menggunakan SIPERAH-RoB?**
> Peta publik dapat diakses oleh siapa saja tanpa login. Fitur pelaporan tersedia untuk warga terdaftar. Dashboard BPBD dikhususkan untuk admin sistem. Portal penelitian untuk peneliti yang disetujui.

**Q: Seberapa sering peta diperbarui?**
> Prediksi diperbarui otomatis setiap hari sekitar **pukul 06:00 WIB** melalui pipeline model ML di GitHub Actions. Laporan warga yang telah divalidasi operator langsung tampil di peta.

### Teknis

**Q: Mengapa lokasi GPS saya tidak terdeteksi?**
> Pastikan Anda telah memberikan **izin akses lokasi** di browser Anda. Pada Chrome: klik ikon gembok di address bar → Site Settings → Location → Allow.

**Q: Format foto apa yang didukung untuk pelaporan?**
> JPG, PNG, dan WebP. Maksimal 5 foto dengan ukuran masing-masing ≤ 2 MB. Foto akan otomatis dikompres ke WebP.

**Q: Bagaimana jika saya lupa kata sandi?**
> Gunakan fitur **Lupa Kata Sandi** di halaman login. Kode OTP akan dikirim ke email terdaftar.

**Q: Bagaimana cara mendapatkan API Key untuk riset?**
> Daftar sebagai **Peneliti**, tunggu persetujuan admin, lalu ajukan permohonan akses API di Portal Peneliti. Setelah disetujui, Anda dapat membuat API Key.

---

> **Versi Dokumen**: 1.2.0  
> **Terakhir Diperbarui**: Juli 2026  
> **Kontak Teknis**: Tim Pengembang SIPERAH-RoB — Provinsi Lampung
