# Tinjauan Konsistensi Copywriting & Istilah

Dokumen ini memetakan standardisasi istilah (*vocabulary mapping*) yang disepakati untuk digunakan secara konsisten pada antarmuka frontend, respons API backend, notifikasi, dan dokumen akademis laporan tugas akhir.

---

## 1. Tingkat Risiko Wilayah (`risk_class`)
Digunakan untuk klasifikasi tingkat ancaman rob di peta dan dashboard.

| Database Value | Label UI (Bahasa Indonesia) | Warna Peta / Indikator | Definisi & Batasan |
| :--- | :--- | :--- | :--- |
| `rendah` | **Rendah** | Hijau (`#10B981`) | Tidak ada genangan rob, aman untuk beraktivitas. |
| `sedang` | **Sedang** | Kuning (`#FBBF24`) | Potensi genangan minor di jalan raya (<10cm). |
| `tinggi` | **Tinggi** | Oranye (`#F97316`) | Genangan 10-30cm, air mulai masuk pekarangan. |
| `sangat_tinggi` | **Sangat Tinggi** | Merah (`#EF4444`) | Banjir rob parah (>30cm), akses jalan terputus. |

---

## 2. Status Validasi Laporan (`report_status`)
Status verifikasi laporan warga oleh operator BPBD.

| Database Value | Label UI (Bahasa Indonesia) | Warna Badge | Keterangan untuk Pengguna |
| :--- | :--- | :--- | :--- |
| `menunggu` | **Menunggu Verifikasi** | Abu-abu | Laporan telah diterima sistem, menunggu verifikasi operator. |
| `perlu_review` | **Butuh Review Ulang** | Biru | Laporan dilaporkan di luar zona pantauan, perlu peninjauan operator. |
| `divalidasi` | **Tervalidasi** | Hijau | Laporan diverifikasi benar, muncul di peta publik. |
| `ditolak` | **Ditolak** | Merah | Laporan ditolak oleh operator (alasan penolakan dilampirkan). |
| `duplikat` | **Laporan Duplikat** | Kuning | Kejadian sama sudah dilaporkan warga lain, laporan diarsipkan. |

---

## 3. Tingkat Keparahan Laporan Ground Truth (`severity`)
Tingkat genangan rob aktual di lapangan yang dilaporkan oleh warga.

| Database Value | Label UI (Bahasa Indonesia) | Batasan Tinggi Air (Hitungan Otomatis) |
| :--- | :--- | :--- |
| `ringan` | **Ringan** | Tinggi air **< 10 cm** (basah di jalan). |
| `sedang` | **Sedang** | Tinggi air **10 s.d. 30 cm** (semata kaki s.d. betis). |
| `parah` | **Parah** | Tinggi air **31 s.d. 80 cm** (selutut s.d. paha). |
| `sangat_parah` | **Sangat Parah** | Tinggi air **> 80 cm** (sepinggang ke atas). |

---

## 4. Peran Pengguna (`user_role`)

| Database Value | Nama Peran Resmi (UI) | Deskripsi Hak Akses |
| :--- | :--- | :--- |
| `warga` | **Warga Masyarakat** | Akses peta publik, kirim laporan, kelola preferensi notifikasi pribadi. |
| `bpbd_operator` | **Operator BPBD Kab/Kota** | Mengelola antrean validasi laporan warga sesuai wilayah kerjanya. |
| `bpbd_provinsi` | **BPBD Provinsi** | Melihat summary lintas kabupaten, tren prediksi, ekspor data daerah. |
| `peneliti` | **Peneliti Akademik** | Mengunduh dataset historis terstruktur dan mengelola API Key peneliti. |
| `admin` | **Administrator Sistem** | Menyetujui pendaftaran akun, edit role/wilayah, memantau audit log. |

---

## 5. Status Keaktifan Pengguna (`user_status`)

| Database Value | Label Status Resmi (UI) | Dampak pada Sistem |
| :--- | :--- | :--- |
| `menunggu` | **Menunggu Persetujuan** | Pendaftaran akun baru, belum di-approve admin, tidak bisa login. |
| `aktif` | **Aktif** | Akun disetujui, hak akses penuh sesuai role. |
| `nonaktif` | **Nonaktif** | Akun dinonaktifkan sementara/permanen, login diblokir (403 Forbidden). |
| `ditolak` | **Ditolak** | Pendaftaran akun ditolak admin. |
