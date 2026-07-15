# Product Requirements Document — SIPERAH-RoB

| | |
|---|---|
| **Produk** | SIPERAH-RoB |
| **Nama Lengkap** | Sistem Informasi Prediksi Risiko Banjir Rob Terpadu Provinsi Lampung |
| **Jenis Dokumen** | Product Requirements Document (PRD) |
| **Versi** | 0.1 (Draft) |
| **Tanggal** | 8 Juli 2026 |
| **Disusun berdasarkan** | 14 mockup UI/UX (`SIG_Penelitian_2026.zip`) — belum ada spesifikasi teknis tertulis sebelumnya |
| **Status** | Draft — kebutuhan diturunkan dari desain, perlu divalidasi ulang oleh tim/pembimbing |

> Catatan: dokumen ini disusun dengan menurunkan (reverse-engineer) kebutuhan produk dari mockup yang sudah ada, bukan sebaliknya. Bagian yang murni asumsi ditandai eksplisit di Bagian 11 dan 12 agar mudah divalidasi.

---

## 1. Ringkasan Eksekutif

SIPERAH-RoB adalah sistem informasi geografis (SIG) berbasis web yang memprediksi dan memantau risiko **banjir rob** (genangan air laut akibat pasang tinggi) di wilayah pesisir Provinsi Lampung. Sistem menggabungkan model *machine learning* dengan data resmi (BMKG, BIG, BPS) dan laporan lapangan dari warga (*ground truth*) untuk menghasilkan peta risiko yang diperbarui harian, mendukung pengambilan keputusan BPBD di tingkat kabupaten/kota maupun provinsi, serta membuka akses data terstruktur untuk keperluan penelitian.

## 2. Latar Belakang & Masalah

- Wilayah pesisir Lampung — 7 dari 15 kabupaten/kota, mencakup 283 kelurahan pesisir — rawan banjir rob, terutama saat kondisi astronomis ekstrem (perigee bertepatan bulan baru/purnama).
- **[Asumsi, perlu divalidasi]** Belum ada sistem terpadu yang menggabungkan prediksi berbasis data dengan verifikasi lapangan secara real-time untuk wilayah ini.
- BPBD memerlukan satu titik pantau lintas kabupaten untuk memprioritaskan respons; saat ini informasi kemungkinan tersebar per instansi/kabupaten.
- Warga pesisir memerlukan informasi risiko yang mudah dipahami di level lokasi mereka masing-masing, bukan data spasial mentah.
- Peneliti memerlukan akses data historis banjir rob yang terstruktur, terdokumentasi, dan bisa diunduh untuk mendukung studi lanjutan.

## 3. Tujuan & Sasaran

1. Menyediakan prediksi risiko banjir rob berbasis ML dengan akurasi terukur (baseline mockup: 87%, precision 0.89, recall 0.85) untuk cakrawala 0–7 hari.
2. Memberi warga pesisir informasi risiko yang *actionable* di level lokasi mereka tanpa perlu keahlian membaca data spasial ("Mode Awam").
3. Memungkinkan BPBD memantau, memvalidasi laporan warga, dan memprioritaskan respons lintas kabupaten dari satu dashboard.
4. Membangun mekanisme crowdsourcing (laporan ground truth) yang datanya dipakai memvalidasi dan meningkatkan model prediksi dari waktu ke waktu.
5. Membuka akses data terstruktur (arsip dataset + API) untuk peneliti dengan lisensi yang jelas.

## 4. Target Pengguna & Peran

| Role | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Warga** | Penduduk wilayah pesisir; akses peta publik tanpa login, akses pelaporan dengan akun | Info risiko di lokasinya, cara mudah melapor kejadian, notifikasi dini |
| **BPBD Operator** | Petugas BPBD tingkat kabupaten/kota | Verifikasi cepat laporan warga, pantau status kelurahan di wilayah kerjanya |
| **BPBD Provinsi** | Pengambil keputusan tingkat provinsi | Ringkasan lintas kabupaten, tren, dasar prioritas alokasi sumber daya |
| **Peneliti** | Akademisi/pihak eksternal | Akses dataset historis terstruktur, API terdokumentasi |
| **Admin** | Pengelola sistem | Kelola akun & role pengguna, audit aktivitas sistem |

## 5. Ruang Lingkup

### 5.1 Dalam Lingkup (teramati di mockup)
- Peta interaktif publik (desktop & mobile) dengan klasifikasi risiko 4 level
- "Mode Awam" — tampilan simplifikasi berbasis lokasi untuk pengguna non-teknis
- Form pelaporan ground truth 3 langkah dengan unggah foto
- Dashboard monitoring BPBD, 2 level: provinsi dan operator kab/kota
- Alur verifikasi/validasi laporan warga oleh operator BPBD
- Manajemen pengguna & role oleh admin, termasuk approval akun baru
- Audit log seluruh aktivitas sistem
- Portal arsip data & API untuk peneliti, dengan manajemen API key
- Pengaturan notifikasi multi-kanal (push, email, WhatsApp, SMS) dengan jam sunyi
- Halaman onboarding & FAQ untuk pengguna publik

### 5.2 Di Luar Lingkup (versi ini)
- Pelatihan ulang (retraining) model ML — sistem mengonsumsi hasil prediksi, bukan melatih model
- Fitur komersial/pembayaran
- Aplikasi mobile native — mockup mengindikasikan web responsive, bukan aplikasi native
- Cakupan di luar Provinsi Lampung

## 6. Kebutuhan Fungsional

### 6.1 Portal Publik — Peta & Informasi Risiko (`FR-PUB`)
- **FR-PUB-1**: Menampilkan peta interaktif dengan klasifikasi risiko 4 level (Rendah/Sedang/Tinggi/Sangat Tinggi) per kelurahan.
- **FR-PUB-2**: Pengguna dapat memilih horizon prediksi: hari ini, +1, +2, +3, +7 hari.
- **FR-PUB-3**: Peta mendukung toggle layer: zona bahaya rob, laporan ground truth, infrastruktur kritis, jalur evakuasi, data pasang surut BMKG.
- **FR-PUB-4**: Menampilkan panel detail per wilayah saat diklik — nama wilayah, kelas bahaya, probabilitas (%), estimasi populasi berisiko.
- **FR-PUB-5**: Menampilkan banner peringatan aktif dari BMKG saat kondisi ekstrem (mis. perigee + bulan baru), termasuk jumlah kabupaten terdampak.
- **FR-PUB-6**: Tersedia versi desktop dan mobile-responsive untuk peta publik.
- **FR-PUB-7**: Pengguna publik dapat mengekspor data peta.

### 6.2 Mode Awam — Status Bahaya Personal (`FR-AWAM`)
- **FR-AWAM-1**: Mendeteksi lokasi pengguna otomatis (geolokasi) atau manual.
- **FR-AWAM-2**: Menampilkan status bahaya lokasi pengguna dengan bahasa non-teknis dan indikator visual yang jelas.
- **FR-AWAM-3**: Menampilkan probabilitas, tinggi pasang maksimum, dan waktu puncak prediksi.
- **FR-AWAM-4**: Menampilkan prakiraan 7 hari ke depan.
- **FR-AWAM-5**: Menampilkan laporan warga di sekitar lokasi beserta status validasinya.

### 6.3 Pelaporan Ground Truth (`FR-GT`)
- **FR-GT-1**: Alur pelaporan 3 langkah — (1) pilih lokasi via peta, (2) isi tingkat keparahan & deskripsi, (3) unggah foto & kirim.
- **FR-GT-2**: Klasifikasi keparahan berbasis tinggi genangan: Ringan (<10 cm), Sedang (10–30 cm), Parah (30–80 cm), Sangat Parah (>80 cm).
- **FR-GT-3**: Sistem mencatat koordinat lokasi, waktu kejadian, dan estimasi tinggi air.
- **FR-GT-4**: Laporan berstatus "menunggu" hingga diverifikasi BPBD, dengan target SLA verifikasi 1×24 jam.

### 6.4 Dashboard BPBD — Operator (`FR-OPS`)
- **FR-OPS-1**: Operator dapat memfilter tampilan berdasarkan wilayah kerjanya.
- **FR-OPS-2**: Menampilkan antrean laporan masuk yang butuh verifikasi, dengan aksi Validasi / Tolak / Detail.
- **FR-OPS-3**: Menampilkan alert saat ada laporan baru yang butuh verifikasi segera, termasuk wilayah terdampak.
- **FR-OPS-4**: Menampilkan status bahaya per kelurahan di wilayah operator (level bahaya, populasi risiko, waktu update terakhir).
- **FR-OPS-5**: Menampilkan ringkasan KPI: kelurahan pantau aktif, jumlah kelurahan bahaya sangat tinggi, laporan menunggu, jumlah validasi bulan berjalan.

### 6.5 Dashboard BPBD — Provinsi (`FR-PROV`)
- **FR-PROV-1**: Menampilkan ringkasan lintas kabupaten: kabupaten dipantau, kelurahan bahaya tinggi+, total populasi risiko, laporan tervalidasi bulan ini.
- **FR-PROV-2**: Tabel risiko per kabupaten yang dapat diurutkan, menampilkan jumlah kelurahan per kelas bahaya, populasi risiko, dan tren (naik/turun/stabil).
- **FR-PROV-3**: Grafik prediksi 30 hari ke depan (jumlah kelurahan kelas Sangat Tinggi).
- **FR-PROV-4**: Filter berdasarkan periode (bulan) dan kabupaten, serta ekspor data.

### 6.6 Administrasi Sistem (`FR-ADM`)
- **FR-ADM-1**: Admin dapat menambah pengguna serta meninjau, menyetujui, atau menolak permintaan akun baru.
- **FR-ADM-2**: Admin dapat mengelola role (Admin / BPBD Provinsi / BPBD Operator / Peneliti / Warga), instansi/wilayah, dan status akun (aktif/nonaktif).
- **FR-ADM-3**: Sistem mencatat audit log untuk aksi penting: login, logout, validasi laporan, penolakan laporan, ekspor data, perubahan data pengguna, dan update model — masing-masing dengan aktor, target, waktu, dan outcome (success/fail/denied/partial).
- **FR-ADM-4**: Audit log dapat difilter berdasarkan jenis aksi dan outcome, dicari, serta diekspor.

### 6.7 Portal Peneliti & API (`FR-PEN`)
- **FR-PEN-1**: Peneliti dapat melihat dan mengunduh dataset (prediksi harian, ground truth tervalidasi, data mentah pasang surut BMKG) dalam format CSV/JSON.
- **FR-PEN-2**: Setiap dataset menampilkan metadata: jenis, periode cakupan, resolusi, jumlah rekaman, dan lisensi.
- **FR-PEN-3**: Sistem menyediakan manajemen API key (lihat, salin, regenerasi).
- **FR-PEN-4**: Menampilkan statistik pemakaian: jumlah dataset tersedia, total rekaman, unduhan bulan berjalan, jumlah panggilan API harian.
- **FR-PEN-5**: Tersedia dokumentasi referensi API dan halaman perizinan/lisensi data sebagai tab terpisah.

### 6.8 Notifikasi (`FR-NOTIF`)
- **FR-NOTIF-1**: Pengguna dapat memilih kanal notifikasi — push browser, email, WhatsApp; SMS tersedia khusus untuk operator BPBD.
- **FR-NOTIF-2**: Pengguna dapat berlangganan jenis event: peringatan bahaya sangat tinggi, laporan ground truth baru, update model prediksi, ringkasan harian, peringatan BMKG pasang ekstrem.
- **FR-NOTIF-3**: Pengguna dapat mengatur "jam sunyi" untuk menahan notifikasi non-kritis; peringatan sangat tinggi dan darurat tetap terkirim meski jam sunyi aktif.
- **FR-NOTIF-4**: Pengguna dapat menambah/menghapus wilayah (kelurahan/kecamatan) yang dipantau untuk notifikasi.

### 6.9 Onboarding (`FR-OB`)
- **FR-OB-1**: Tersedia halaman panduan yang menjelaskan konsep banjir rob, cara membaca klasifikasi warna peta, dan cara melapor.
- **FR-OB-2**: Tersedia FAQ mencakup akurasi model, sumber data, hak akses per role, dan frekuensi update peta.

## 7. Alur Pengguna Utama

**Alur A — Warga melihat risiko & melapor kejadian**
1. Warga membuka peta publik tanpa login → melihat status wilayahnya.
2. *(Opsional)* Beralih ke Mode Awam untuk tampilan simpel berbasis lokasi.
3. Warga melihat/mengalami genangan → membuka form lapor.
4. Pilih lokasi → isi keparahan & deskripsi → unggah foto → kirim.
5. Laporan berstatus "menunggu verifikasi".

**Alur B — Operator BPBD memvalidasi laporan**
1. Operator menerima notifikasi laporan baru masuk.
2. Membuka antrean laporan di dashboard operator.
3. Meninjau detail: foto, lokasi, deskripsi, tingkat keparahan.
4. Menekan Validasi atau Tolak.
5. Laporan tervalidasi masuk ke data ground truth dan tampil di peta publik.

**Alur C — BPBD Provinsi memantau & memprioritaskan**
1. Membuka dashboard provinsi, meninjau ringkasan lintas kabupaten.
2. Mengurutkan tabel kabupaten berdasarkan populasi risiko atau tren.
3. Menindaklanjuti kabupaten prioritas melalui koordinasi dengan operator terkait.

**Alur D — Peneliti mengambil data**
1. Peneliti masuk ke portal peneliti.
2. Memfilter dataset berdasarkan tahun, kabupaten, dan jenis data.
3. Mengunduh dataset (CSV/JSON) atau mengaksesnya lewat API key.

**Alur E — Admin mengelola akses**
1. Admin meninjau permintaan akun baru.
2. Menyetujui/menolak, menetapkan role dan wilayah kerja.
3. Aktivitas tercatat otomatis di audit log.

## 8. Model Prediksi & Sumber Data

- **Model**: Random Forest v1.2.0 (baseline yang tercantum di mockup).
- **Performa**: akurasi 87%, precision 0.89, recall 0.85 — dievaluasi pada data historis 2018–2024; performa terbaik pada horizon 0–3 hari ke depan.
- **Sumber data**:
  - BMKG — data pasang surut real-time & historis
  - BIG — data batimetri
  - BPS — data kependudukan
  - Data historis kejadian banjir rob 2018–2024
  - Laporan ground truth warga yang telah divalidasi BPBD
- **Frekuensi update**: harian pukul 05:00 WIB; naik menjadi 2×/hari saat ada peristiwa astronomis signifikan (perigee, ekuinoks).

## 9. Kebutuhan Non-Fungsional

- **Akses & Otorisasi**: RBAC 5 level (Admin, BPBD Provinsi, BPBD Operator, Peneliti, Warga). Peta publik dapat diakses tanpa login; fitur pelaporan dan seluruh dashboard memerlukan akun terverifikasi.
- **Ketepatan Waktu**: prediksi diperbarui sesuai jadwal (lihat Bagian 8); target SLA verifikasi laporan warga 1×24 jam.
- **Auditabilitas**: seluruh aksi sensitif (validasi, penolakan, ekspor data, perubahan user, update model) wajib tercatat di audit log dengan outcome yang jelas.
- **Multi-kanal Notifikasi**: minimal tersedia 2 kanal (push & email), dengan WhatsApp/SMS sebagai kanal tambahan sesuai role.
- **Aksesibilitas Bahasa**: Mode Awam harus dapat dipahami pengguna non-teknis — bahasa sederhana, minim jargon spasial/statistik.
- **Lisensi Data**: dataset yang dibagikan ke peneliti mencantumkan lisensi eksplisit (mis. CC-BY 4.0 untuk data turunan; mengikuti lisensi sumber untuk data mentah BMKG).
- **Cakupan & Skala**: sistem harus mendukung hingga 15 kabupaten/kota dan 283+ kelurahan pesisir di Provinsi Lampung, dengan ruang tumbuh untuk penambahan wilayah pantauan.

## 10. Metrik Keberhasilan (usulan)

- Akurasi model tetap terjaga di sekitar baseline (87%) pada evaluasi berkelanjutan.
- Persentase laporan ground truth yang tervalidasi dalam SLA 1×24 jam.
- Jumlah warga aktif memakai fitur pelaporan per bulan.
- Jumlah kabupaten/kota yang aktif memantau, menuju cakupan penuh 15/15.
- Jumlah peneliti terdaftar & volume unduhan dataset per bulan.
- Waktu rata-rata dari laporan warga masuk hingga tervalidasi BPBD.

## 11. Asumsi & Batasan

- Dua file pendukung desain (`_app.css`, `_nav.js`) tidak tersertakan dalam arsip mockup — dokumen ini disusun murni dari konten & interaksi yang terlihat di 14 layar, bukan dari spesifikasi teknis tertulis sebelumnya.
- Model ML diasumsikan dilatih di luar sistem ini; sistem mengonsumsi hasil prediksi, bukan melatih ulang model.
- Alur lupa kata sandi, reset akun, dan proses banding atas laporan yang ditolak belum tercakup di mockup — perlu didefinisikan lebih lanjut.
- Definisi pasti untuk menangani "kejadian duplikat" pada laporan ground truth belum tercakup di mockup.
- Belum ada mockup yang menjelaskan proses onboarding **peneliti** (persetujuan akses dataset, verifikasi institusi) selain daftar akun secara umum di halaman admin.

## 12. Pertanyaan Terbuka

- Bagaimana mekanisme jika hasil model prediksi dan laporan ground truth warga saling bertentangan secara signifikan?
- Apakah warga wajib registrasi untuk melapor, atau dimungkinkan lapor semi-anonim dengan verifikasi minimal (mis. nomor HP)?
- Siapa yang berwenang meregenerasi API key peneliti — peneliti sendiri, admin, atau keduanya?
- Apakah ada rencana integrasi dengan sistem BPBD/BNPB tingkat nasional di luar cakupan provinsi ini?
- Bagaimana penanganan laporan ground truth di kelurahan yang belum masuk 283 kelurahan pesisir yang dipantau?

## 13. Lampiran — Pemetaan Mockup ke Modul

| File Mockup | Modul | Deskripsi Singkat |
|---|---|---|
| `index.html` | Portal Utama | Landing page, routing ke 4 portal berbasis role |
| `mockup_7_login_register.html` | Autentikasi | Login / Register |
| `mockup_1_peta_publik_desktop.html` | Portal Publik | Peta interaktif — desktop |
| `mockup_5_peta_publik_mobile.html` | Portal Publik | Peta interaktif — mobile |
| `mockup_3_mode_awam_mobile.html` | Mode Awam | Status bahaya personal — mobile |
| `mockup_4_form_laporan_ground_truth.html` | Ground Truth | Form lapor, langkah 1–2 |
| `mockup_8_ground_truth_step3.html` | Ground Truth | Form lapor, langkah 3 (foto & kirim) |
| `mockup_9_onboarding_mode_awam.html` | Onboarding | Panduan pengguna & FAQ |
| `mockup_2_dashboard_bpbd_provinsi.html` | Dashboard BPBD | Level provinsi |
| `mockup_6_dashboard_bpbd_operator.html` | Dashboard BPBD | Level operator kab/kota |
| `mockup_11_admin_user_management.html` | Administrasi | Manajemen pengguna & role |
| `mockup_13_audit_log_viewer.html` | Administrasi | Audit log |
| `mockup_12_researcher_archive_api.html` | Portal Peneliti | Arsip dataset & manajemen API key |
| `mockup_10_notification_settings.html` | Notifikasi | Pengaturan lintas-portal |
