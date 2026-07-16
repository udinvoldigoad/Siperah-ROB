# Daftar Tugas SIPERAH-RoB — Terstruktur & Terurut

> Dokumen kerja pengganti tampilan "sisa pekerjaan" dari `production-readiness-checklist.md`.
> Isinya **hanya yang belum selesai**, disusun berurutan per tahap: kerjakan Tahap 1 dulu sampai tuntas, baru lanjut Tahap 2, dan seterusnya. Item yang sudah `[x]` di checklist lama tidak ditulis ulang di sini.
>
> Cara pakai:
> - Centang `[x]` saat tugas selesai **dan** kriteria selesai terpenuhi.
> - Tanda prioritas: **P1** = wajib agar fungsi inti berjalan benar, **P2** = penting untuk kualitas production, **P3** = boleh ditunda/keputusan tim.
> - Kalau sebuah tugas butuh keputusan (bukan koding), ditandai `(keputusan)`.

---

## Tahap 1 — Data inti & pipeline ML jadi resmi

Fondasi semua fitur: peta, dashboard, dan mode awam hanya sebagus datanya. Kerjakan ini paling awal.

### 1.1 Data wilayah

- [ ] **P1** Audit cakupan wilayah pesisir: cakupan resmi = **8 kabupaten/kota pesisir** sesuai stasiun pipeline ML (`ml-api/files/data_fetcher.py`): Bandar Lampung, Lampung Selatan, Pesawaran, Tanggamus, Pesisir Barat, Lampung Timur, Tulang Bawang, Mesuji *(keputusan 2026-07-16; teks PRD "7 dari 15" perlu dikoreksi menyusul)*. Pastikan 8 kabupaten itu + kelurahan pesisirnya lengkap di tabel `regions`. Angka 15 kab/kota hanya batas skala "hingga" di PRD, bukan target sekarang.
  - *Progres 2026-07-16*: `coastal_flag` diperbaiki 20 → **321** wilayah via `data:classify-coastal-regions` (fallback Haversine ke garis pantai BIG); prediksi ML kini mencakup semuanya (9.951 baris). Sisa: **Mesuji masih 0** (polygon desa 8+ km dari garis pantai terpetakan), verifikasi silang 321 vs referensi 283 kelurahan PRD/BPS. Detail: `docs/audit-wilayah-2026-07-16.md`.
  - Selesai jika: query hitung per kabupaten cocok dengan referensi BIG/BPS untuk 8 wilayah itu, hasil audit dicatat di docs.
- [x] **P1** Audit kualitas geometri: command `data:audit-regions` diperluas (breakdown pesisir vs 8 stasiun ML, boundary_status, format geometri GeoJSON/WKT, duplikasi, kode kosong; `ST_IsValid` otomatis saat PostGIS ada). Temuan: 2.640 GeoJSON BIG asli + 8 kotak demo, tidak ada geometri kosong/duplikat — dicatat di `docs/audit-wilayah-2026-07-16.md`.
- [ ] **P1** Pasang PostGIS di database (dev & production): Postgres 18.3 dev belum punya ekstensi (`geometry` masih text/GeoJSON) padahal keputusan arsitektur "PostGIS wajib". Pasang bundel PostGIS untuk PG18 (Stack Builder), `CREATE EXTENSION postgis`, jalankan migrasi konversi spasial, lalu ulangi `data:classify-coastal-regions` via jalur PostGIS.
- [ ] **P2** Tegakkan `boundary_status` yang jelas per wilayah: official / estimated / manual / invalid.
  - Selesai jika: tiap baris `regions` punya status, dan peta publik bisa membedakannya (minimal di metadata).
- [ ] **P2** Validasi data wilayah production dari BIG (bukan dummy/manual).
  - Selesai jika: sinkronisasi BIG dijalankan penuh dan tanggal sinkron tercatat.

### 1.2 Data pasang surut & cuaca

- [ ] **P1** Integrasikan data pasang surut real/historis dengan sumber jelas (mengganti model harmonik simulasi).
  - Selesai jika: tabel `tidal_data` terisi dari sumber resmi, dan `ml-api` membaca dari tabel itu (bukan simulasi) saat tersedia.
- [ ] **P1** Validasi kualitas tidal: missing value, outlier, duplikasi timestamp, metadata stasiun.
  - Selesai jika: ada langkah validasi di pipeline import yang menolak/menandai data buruk.
- [ ] **P2** Jadwal refresh data harian pukul 05:00 WIB (sebelum `ml:predict` 06:00 yang sudah terpasang).
  - Selesai jika: scheduler Laravel menjalankan fetch data 05:00 Asia/Jakarta dan hasilnya terverifikasi.
- [ ] **P3** Refresh 2x/hari saat event astronomis signifikan (purnama/perigee).
- [ ] **P2** Integrasi peringatan dini cuaca BMKG (untuk banner peringatan di peta publik).
  - Selesai jika: banner "peringatan aktif" di peta publik membaca sumber resmi, bukan derivasi prediksi sendiri.
- [ ] **P3** `(keputusan)` Integrasi data gempa/tsunami BMKG — putuskan relevan atau tidak untuk lingkup RoB.

### 1.3 Prediksi ML production

- [ ] **P1** Validasi `model_version` dan provenance untuk setiap baris prediksi.
  - Selesai jika: tiap prediksi menyimpan versi model + sumber data, dan endpoint publik menampilkannya.
- [ ] **P1** Handling saat prediksi hari ini belum tersedia (pipeline gagal/terlambat).
  - Selesai jika: frontend & mode awam menampilkan status "prediksi belum diperbarui" dengan timestamp terakhir, bukan data basi tanpa keterangan.
- [ ] **P2** Evaluasi akurasi model berkala: precision, recall, drift tracking dari laporan tervalidasi BPBD.
  - Selesai jika: ada command/laporan evaluasi yang membandingkan prediksi vs kejadian nyata per periode.
- [ ] **P2** Audit log untuk update model/prediksi (siapa/kapan/versi apa).
- [ ] **P2** Pisahkan seed demo dari data reference production secara tegas.
  - Selesai jika: `DemoSeeder` tidak pernah tersentuh di production, dan seed reference (wilayah, dsb.) punya seeder terpisah.

---

## Tahap 2 — Melengkapi fungsi backend per fitur

Kerjakan setelah Tahap 1 karena banyak yang bergantung pada data yang benar.

### 2.1 Peta publik (FR-PUB)

- [ ] **P1** Layer infrastruktur kritis (data + endpoint + geometri).
- [ ] **P1** Layer jalur evakuasi (data + endpoint + geometri).
  - Catatan: dua layer ini butuh **sumber data** dulu — pastikan datanya ada sebelum koding. `(keputusan sumber data)`
- [ ] **P2** Rate limit endpoint publik disetel untuk trafik production (bukan default dev).
- [ ] **P2** Pantau/cache ukuran response GeoJSON agar peta cepat (simplify geometri atau cache per horizon).

### 2.2 Dashboard operator & provinsi

- [ ] **P1** Audit data wilayah kerja operator: setiap operator punya `region_id` valid dan filter antrean sesuai wilayahnya.
- [ ] **P2** Definisi matematis grafik tren provinsi 30 hari sesuai PRD (bukan sekadar ada/tidak risiko).
- [ ] **P2** Populasi berisiko berbasis data BPS/region valid (kolom `population` sudah ada — pastikan terisi resmi).

### 2.3 Portal peneliti & API (FR-PEN)

- [ ] **P1** Jalankan & tes migrasi filter kabupaten dataset yang sudah ditulis tapi belum dijalankan.
- [ ] **P1** Perbaiki timezone statistik "API calls today" dari UTC ke Asia/Jakarta.
- [ ] **P2** Increment penggunaan API key dibuat atomic + logging outcome mencakup exception.
- [ ] **P2** Rate limit API v1 dibuat configurable via env (bukan hardcode 120/menit).
- [ ] **P2** Lengkapi konten tab lisensi/perizinan data.
- [ ] **P2** Perluas sanitasi CSV injection & penyaringan data sensitif ke semua dataset + test.
- [ ] **P3** Finalkan kontrak/stabilitas API `/api/v1/*` (versi, deprecation policy).

### 2.4 Lain-lain backend

- [ ] **P2** `(keputusan)` Storage foto: tetap public disk atau pindah cloud/signed URL (tergantung sensitivitas & trafik).
- [ ] **P3** `(keputusan)` Kolom alasan akses naratif peneliti — hanya jika SKPL mewajibkan.

---

## Tahap 3 — Melengkapi fungsi frontend per fitur

### 3.1 Fondasi frontend

- [ ] **P1** Error boundary global (halaman error ramah, bukan blank putih saat komponen crash).
- [ ] **P1** Guard route per role di frontend (warga tidak bisa buka URL admin, dst. — backend sudah menolak, UI harus redirect rapi).
- [ ] **P1** UI status akun pending/nonaktif/ditolak yang jelas saat login.
- [ ] **P2** Sinkronkan role saat register dengan backend (backend default warga — form register jangan menjanjikan role lain).
- [ ] **P2** Hilangkan dev shortcuts dari build production.
- [ ] **P2** Code splitting (dynamic import) untuk map/dashboard/research — hilangkan warning chunk >500 kB.
- [ ] **P2** Konsistenkan loading/skeleton state, empty state, dan toast di semua halaman.
- [ ] **P3** Accessibility audit: navigasi keyboard, focus ring, kontras, aria-label.

### 3.2 Peta publik & mode awam

- [ ] **P1** Toggle layer lengkap sesuai PRD: zona bahaya, laporan, infrastruktur kritis, evakuasi, pasang surut (menyusul layer backend Tahap 2.1).
- [ ] **P2** Export data peta dari UI (backend sudah ada — pastikan tombol & format benar).
- [ ] **P2** QA regression pin/zona saat filter kabupaten aktif.
- [ ] **P2** Uji geolokasi mode awam di perangkat mobile nyata (izin lokasi, akurasi, fallback manual).
- [ ] **P2** QA mobile map UX (gesture, ukuran kontrol, panel detail).
- [ ] **P3** Cek final konsistensi legend & warna vs risk class (sudah satu sumber `shared/constants/risk` — tinggal QA visual).

### 3.3 Dashboard operator

- [ ] **P1** Alert laporan baru realtime/polling (badge antrean bertambah tanpa refresh manual).
- [ ] **P2** Export laporan operator dari UI (backend sudah ada endpoint-nya).
- [ ] **P2** Status kelurahan memakai data real & lengkap (bergantung audit wilayah Tahap 1.1).
- [ ] **P2** QA alur laporan `perlu_review` end-to-end.
- [ ] **P3** UX antrean lanjutan: badge SLA overdue & filter cepat severity (backend sudah siap: `sla=overdue`, `severity`).

### 3.4 Dashboard provinsi

- [ ] **P2** Filter periode (bulan) dan kabupaten.
- [ ] **P2** Sorting interaktif tabel risiko per kabupaten.
- [ ] **P3** `(keputusan)` Print/export ringkasan — hanya jika SKPL mewajibkan.

### 3.5 Admin

- [ ] **P3** Poles UX edit inline role/wilayah/status (fungsi sudah ada via PATCH).

---

## Tahap 4 — Notifikasi production (FR-NOTIF)

Blok fitur utuh yang paling besar sisa pekerjaannya. Kerjakan sebagai satu paket setelah fungsi inti stabil.

- [ ] **P1** Pilih & pasang queue driver production (database queue paling sederhana; Redis jika trafik tinggi). `(keputusan)`
- [ ] **P1** Browser push production: permission flow di frontend + pengiriman via service worker/FCM.
- [ ] **P1** Email production: konfigurasi SMTP/provider + template pesan per event.
- [ ] **P2** WhatsApp production (provider resmi WA Business API) — sudah ada kontak WA di mode awam, ini untuk pengiriman keluar.
- [ ] **P2** SMS khusus operator (provider lokal).
- [ ] **P1** Quiet hours benar-benar menahan notifikasi non-kritis, dan peringatan kritis bypass quiet hours.
- [ ] **P1** Subscription wilayah difilter konsisten dengan region penerima.
- [ ] **P2** Retry queue + failure logging untuk semua kanal eksternal.
- [ ] **P2** Template pesan tiap event (laporan baru, validasi, peringatan risiko, SLA overdue).
- [ ] **P2** Frontend: mark read / read all di inbox notifikasi.
- [ ] **P2** Frontend: selector wilayah pantauan pakai autocomplete/dropdown (pola `WilayahPicker` mode awam bisa dipakai ulang).
- [ ] **P2** Frontend: quiet hours UI cocok dengan perilaku backend, status kanal Email/WA/SMS + fallback.

---

## Tahap 5 — Keamanan & RBAC final

- [ ] **P1** Hapus `backend/check_prob.php` sebelum production (sudah ditandai wajib).
- [ ] **P1** Test authorization/policy per endpoint: RBAC negative path semua role (warga → admin = 403, dst.).
- [ ] **P1** Security headers di reverse proxy (nginx/Caddy): CSP, HSTS, X-Frame-Options, X-Content-Type-Options.
- [ ] **P2** Rencana rotasi secret: `APP_KEY`, token API, kredensial DB/email/WA/SMS — tulis prosedurnya.
- [ ] **P2** Dependency audit npm (`npm audit`) — composer sudah bersih, npm belum dicek.

---

## Tahap 6 — Testing menyeluruh

Tulis test sambil/tepat setelah fitur terkait selesai — jangan ditumpuk di akhir.

### 6.1 Backend (PHPUnit)

- [ ] **P1** Test auth + RBAC semua role (login, akses silang role ditolak).
- [ ] **P1** Test submit laporan + upload foto (termasuk WebP, batas 5 foto/2MB).
- [ ] **P1** Test antrean operator `menunggu`/`perlu_review` + validasi/tolak + audit log tercatat.
- [ ] **P2** Test public map (GeoJSON, filter kabupaten, horizon).
- [ ] **P2** Test resolve-region titik dalam/luar pantauan.
- [ ] **P2** Test research download CSV/JSON + API key middleware.
- [ ] **P2** Test notification settings & inbox.
- [ ] **P2** Test import data BIG/tidal/prediksi + scheduler command (`ml:predict`).
- [ ] **P2** Test migration fresh + seed + rollback (masuk CI di Tahap 7).

### 6.2 E2E smoke test (per role)

- [ ] **P1** Login semua role → redirect dashboard benar.
- [ ] **P1** Warga: submit laporan → muncul di riwayat → operator validasi → muncul di peta publik.
- [ ] **P2** Peta publik: filter, horizon, klik wilayah, layer.
- [ ] **P2** Provinsi: lihat summary + export CSV.
- [ ] **P2** Peneliti: download dataset + regenerate API key.
- [ ] **P2** Admin: approve/reject/nonaktifkan user.

---

## Tahap 7 — Infrastruktur production & deploy

Sesuai skema hosting yang sudah disepakati: single VPS, nginx + PHP-FPM + PostgreSQL/PostGIS + Python venv.

- [ ] **P1** `.env.production` terdokumentasi tanpa secret asli (`APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` valid).
- [ ] **P1** CORS production hanya mengizinkan domain frontend resmi; Sanctum/session cookie sesuai domain.
- [ ] **P1** `VITE_API_BASE_URL` production terdokumentasi; tidak ada hardcoded localhost di source.
- [ ] **P1** Cron scheduler aktif di server (`schedule:run` tiap menit) — menjalankan fetch 05:00 & `ml:predict` 06:00.
- [ ] **P1** Queue worker jalan via supervisor/systemd (dibutuhkan Tahap 4).
- [ ] **P1** Backup otomatis DB (pg_dump harian) + storage foto laporan, dengan retention.
- [ ] **P1** Health check endpoint backend (`/api/health` atau sejenis) untuk monitoring.
- [ ] **P2** Log channel production dengan rotation/retention.
- [ ] **P2** CI backend: composer install + PHP lint + PHPUnit. CI frontend: npm ci + tsc + build.
- [ ] **P2** Observability minimal: error log terpantau + alert saat scheduler/pipeline gagal.
- [ ] **P2** Backup restore drill: latihan restore sekali sebelum go-live.
- [ ] **P3** Load test endpoint peta publik, reports, API research.

---

## Tahap 8 — Dokumentasi & serah-terima

- [ ] **P1** Deployment guide (langkah setup VPS sampai jalan, termasuk rollback plan).
- [ ] **P1** Ekstrak SKPL dari `docs/SKPL_SIPERAH_RoB.docx` ke Markdown, lalu buat traceability matrix: Requirement → Endpoint/UI → Test → Status.
- [ ] **P2** Dokumen API final (sudah ada referensi API peneliti — rapikan jadi dokumen utuh).
- [ ] **P2** ERD/database final (update `database/schema.sql` + diagram).
- [ ] **P2** User guide per role (Warga, Operator, Provinsi, Peneliti, Admin).
- [ ] **P2** Admin operation guide + runbook incident: API down, DB down, import gagal, notifikasi gagal.
- [ ] **P2** UAT per role dan catat hasilnya.
- [ ] **P3** Review copywriting final menyeluruh oleh manusia (konsistensi label sudah dibereskan via `shared/constants`).

---

## Definition of Done (ringkas)

Sistem siap production jika:

1. Tahap 1–2 selesai penuh (data & backend inti benar).
2. Tahap 3 P1–P2 selesai (frontend fungsional & rapi).
3. Tahap 4 minimal P1 selesai (push + email + quiet hours + subscription wilayah).
4. Tahap 5 P1 selesai (tidak ada lubang keamanan yang diketahui).
5. Tahap 6 P1 selesai (test inti hijau di CI).
6. Tahap 7 P1 selesai (server, cron, backup, health check jalan).
7. Tahap 8 P1 selesai (deploy guide + traceability SKPL ada).

Item P3 boleh di-defer dengan keputusan tertulis.
