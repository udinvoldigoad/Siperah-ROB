# 🌊 SIPERAH-RoB
> **Sistem Informasi Prediksi Risiko Banjir Rob Terpadu Provinsi Lampung**

[![Version](https://img.shields.io/badge/Version-1.2.0-blue.svg?style=for-the-badge)](file:///c:/laragon/www/Siperah-ROB/README.md)
[![Laravel](https://img.shields.io/badge/Laravel-11-red.svg?style=for-the-badge&logo=laravel)](https://laravel.com)
[![React](https://img.shields.io/badge/React-18-cyan.svg?style=for-the-badge&logo=react)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.11-yellow.svg?style=for-the-badge&logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue.svg?style=for-the-badge&logo=postgresql)](https://postgresql.org)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.6-darkblue.svg?style=for-the-badge&logo=postgresql)](https://postgis.net)

SIPERAH-RoB adalah **Sistem Informasi Geografis (SIG)** berbasis WebGIS terpadu yang memanfaatkan kecerdasan buatan (*Machine Learning*) untuk memproyeksikan, memantau, dan memitigasi bencana banjir rob (genangan pasang air laut) secara *real-time* di wilayah pesisir Provinsi Lampung.

---

## 🛠️ Stack Teknologi (Tech Stack)

| Lapisan (Layer) | Teknologi Utama | Deskripsi Peran |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, MapLibre GL JS, CSS Vanilla | Aplikasi SPA responsif dengan visualisasi peta interaktif berkinerja tinggi. |
| **Backend** | Laravel 11, PHP 8.4, Sanctum, Database Queue | REST API terpusat, pengelola otorisasi (RBAC), audit logs, dan cron worker. |
| **Database** | Supabase (PostgreSQL 17), PostGIS Extension | Penyimpan data spasial wilayah pesisir dan koordinat laporan warga. |
| **ML Engine** | Python 3.11, scikit-learn, Pandas, imbalanced-learn | Pipeline data cuaca ERA5, model Random Forest Classifier, dan balancing SMOTE. |
| **CI/CD & Jobs** | GitHub Actions, hPanel Cron Scheduler | Otomasi deployment, uji integrasi (CI), dan Retraining/Prediction ML harian. |

---

## 1. Arsitektur Sistem (Production Architecture)

Aplikasi dideploy dengan topologi hemat biaya (*cost-effective*) dan redundansi tinggi menggunakan kombinasi cloud resources:

```mermaid
graph TD
    %% Nodes
    warga[Warga & Publik]
    bpbd[Operator & Pimpinan BPBD]
    peneliti[Peneliti Akademik]
    hostinger[Hostinger Shared Hosting<br>PHP 8.4 + Node.js 24]
    supabase[Supabase Cloud Database<br>PostgreSQL 17 + PostGIS]
    github[GitHub Actions Runner]
    openmeteo[Open-Meteo API]

    %% Styles
    style hostinger fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style supabase fill:#022c22,stroke:#10b981,stroke-width:2px,color:#fff
    style github fill:#171515,stroke:#a855f7,stroke-width:2px,color:#fff
    style openmeteo fill:#1e3a8a,stroke:#3b82f6,stroke-width:1px,color:#fff

    %% Connections
    warga -- "Akses Peta & Kirim Laporan (SPA)" --> hostinger
    bpbd -- "Dashboard & Verifikasi" --> hostinger
    peneliti -- "Akses Dataset / API Key" --> hostinger
    
    hostinger -- "Query Data / Simpan Laporan" --> supabase
    github -- "Trigger Harian / ML Predict" --> hostinger
    github -- "Menulis Hasil Prediksi" --> supabase
    openmeteo -- "Data Pasut & Cuaca" --> github
```

---

## 2. Alur Proses Prediksi & Data Flow

Prakiraan risiko bencana rob diperbarui setiap hari melalui tahapan *pipeline* otomatis berikut:

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub Actions
    participant OM as Open-Meteo API
    participant DB as Supabase DB
    participant API as Hostinger API

    GH->>DB: Tarik Parameter Model Pasut (beta) & Koordinat Pesisir
    DB-->>GH: Parameter Harmonik & Wilayah
    GH->>OM: Tarik Prakiraan Cuaca, Angin, & Gelombang
    OM-->>GH: Data Prakiraan Meteorologi
    Note over GH: Jalankan Model Machine Learning<br>(Random Forest Classifier v1.2.0)
    GH->>DB: Batch Insert Hasil Prediksi H+0 s.d. H+30 (predictions)
    DB-->>GH: Berhasil Ditulis
    API->>DB: Query Prediksi untuk Peta WebGIS / Mode Awam
    DB-->>API: Data Spasial Terklasifikasi
```

---

## 3. Peta Portal Dokumentasi Lengkap (Documentation Hub)

Seluruh modul dan dokumentasi resmi tugas akhir dikompilasi secara rapi di dalam portal ini:

```carousel
| Berkas Utama | Kode Blok | Deskripsi Utama |
| :--- | :---: | :--- |
| 📖 [Panduan Deployment Produksi](file:///c:/laragon/www/Siperah-ROB/docs/deployment_guide.md) | `D1` | Prosedur deploy Hostinger + Supabase + cron worker. |
| 📋 [Matriks Ketertelusuran SKPL](file:///c:/laragon/www/Siperah-ROB/docs/SKPL_traceability_matrix.md) | `D2` | Pemetaan Kebutuhan FR ke UI, API, dan berkas pengujian. |
| 🔌 [Kontrak & Referensi API Peneliti](file:///c:/laragon/www/Siperah-ROB/docs/api-contract.md) | `D3` | API key, rate limit, dan endpoint penelitian v1. |
| 🗄️ [Diagram Skema Database (ERD)](file:///c:/laragon/www/Siperah-ROB/docs/erd_diagram.md) | `D4` | Diagram relasi entitas PostgreSQL/PostGIS. |
<!-- slide -->
| Berkas Panduan & Hasil | Kode Blok | Deskripsi Utama |
| :--- | :---: | :--- |
| 👤 [Panduan Pengguna per Peran](file:///c:/laragon/www/Siperah-ROB/docs/user_guide.md) | `D5` | Cara pakai aplikasi untuk Warga, Operator, dan Provinsi. |
| ⚙️ [Runbook Operasional & Insiden](file:///c:/laragon/www/Siperah-ROB/docs/admin_runbook.md) | `D6` | Langkah taktis jika API down, DB down, dan prosedur backup. |
| 🧪 [Laporan Pengujian UAT](file:///c:/laragon/www/Siperah-ROB/docs/uat_results.md) | `D7` | Hasil pengujian skenario E2E Playwright. |
| 📝 [Standardisasi Copywriting & Istilah](file:///c:/laragon/www/Siperah-ROB/docs/copywriting_review.md) | `D8` | Penyeragaman glosarium status dan level risiko UI. |
```

---

## 4. Fitur Utama Sistem

* **🗺️ Visualisasi WebGIS Interaktif**: Zonasi bahaya rob 4 kelas per kelurahan dengan clustering titik laporan berbasis MapLibre GL.
* **📱 Mode Awam (Geolocated EWS)**: Deteksi titik koordinat otomatis menggunakan sensor GPS perangkat pengguna untuk menyajikan ringkasan risiko non-teknis secara instan.
* **📸 Pelaporan Ground Truth Warga**: Pengiriman laporan kejadian banjir rob terintegrasi dengan penentuan koordinat peta dan kompresi WebP gambar otomatis di sisi klien.
* **🔔 Notifikasi Multi-Kanal dengan Quiet Hours**: Pengiriman alert via Email dan Push Browser dengan opsi penahanan pengiriman di jam sunyi personal.
* **🛡️ Audit Logs Transparansi**: Pencatatan riwayat transaksi sensitif untuk keperluan audit (otorisasi, ekspor data, validasi operator).

---

## 5. Panduan Memulai Cepat (Quick Start)

### A. Prasyarat Sistem
* Node.js >= 20
* PHP >= 8.4 (ekstensi `pdo_pgsql`, `pgsql` wajib aktif)
* PostgreSQL dengan ekstensi **PostGIS** terpasang.

### B. Menjalankan Backend (Laravel API)
1. Pindah ke direktori backend:
   ```bash
   cd backend
   composer install
   ```
2. Salin `.env.example` ke `.env` dan masukkan kredensial database Supabase/PostgreSQL Anda.
3. Jalankan migrasi database:
   ```bash
   php artisan migrate --seed
   ```
4. Jalankan server lokal:
   ```bash
   php artisan serve
   ```

### C. Menjalankan Frontend (React + Vite)
1. Pindah ke direktori frontend:
   ```bash
   cd ../frontend
   npm ci
   npm run dev
   ```
2. Buka browser pada alamat `http://localhost:5173`.
