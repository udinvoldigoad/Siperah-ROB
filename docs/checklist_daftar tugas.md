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

- [x] **P1** Audit cakupan wilayah pesisir: cakupan resmi = **8 kabupaten/kota stasiun ML**, final di production 2026-07-17: **311 wilayah pantauan** — 298 hasil klasifikasi PostGIS (`ST_DWithin` 1000 m ke garis pantai BIG, dinilai dari **bagian terbesar polygon**) + **13 desa Kec. Rawa Jitu Utara (Mesuji) ditandai MANUAL** (desa rawa pasang surut muara; daftar di `ClassifyCoastalRegions::MANUAL_COASTAL_DISTRICTS`).
  - *Pelajaran data*: snapshot BIG memuat pecahan polygon nyasar — mis. "Rantau Jaya Ilir" (Lampung Tengah) badan desa 24,7 km dari pantai tetapi punya sliver 1 ha menempel pantai (dikoreksi user 2026-07-17); total 4 desa positif palsu serupa (juga Pagar Dalam/Lemong, Penyandingan/Kelumbayan, Tulung Asahan/Semaka). Klasifikasi kini memakai bagian terbesar polygon sehingga kebal artefak ini.
  - *Sisa kecil (tidak memblokir)*: teks PRD "7 dari 15" perlu dikoreksi jadi cakupan aktual; verifikasi silang 311 vs daftar resmi 283 kelurahan BPS bila daftar itu didapat.
- [x] **P1** Audit kualitas geometri: command `data:audit-regions` diperluas (breakdown pesisir vs 8 stasiun ML, boundary_status, format geometri GeoJSON/WKT, duplikasi, kode kosong; `ST_IsValid` otomatis saat PostGIS ada). Temuan: 2.640 GeoJSON BIG asli + 8 kotak demo, tidak ada geometri kosong/duplikat — dicatat di `docs/audit-wilayah-2026-07-16.md`.
- [x] **P1** Pasang PostGIS di database (dev & production) — SELESAI PENUH 2026-07-18.
  - *Production (2026-07-16/17)*: Supabase PostGIS 3.3.7, kolom spasial asli + GIST + trigger (2.648 valid); klasifikasi via jalur PostGIS: **298 + 13 manual = 311 wilayah** (uji jarak bagian terbesar polygon; 4 positif palsu sliver dihapus, termasuk Rantau Jaya Ilir).
  - *Dev lokal (2026-07-18)*: PostGIS 3.6.2 via Stack Builder, konversi spasial sama dijalankan (2.648 valid, 0 invalid), klasifikasi lokal menghasilkan **311 identik per kabupaten dengan production** — paritas dev-production tercapai.
- [x] **P2** Tegakkan `boundary_status` yang jelas per wilayah (2026-07-17): taksonomi official/estimated/manual/invalid ditegakkan — istilah lama `reference` dinormalisasi ke `official` (migrasi `2026_07_17_normalize_region_boundary_status`, dev+production: official=2640, manual=8 baris demo), `BigRegionSyncService` kini menulis `official`, dan `boundary_status` diekspos di `RegionResource` + properti GeoJSON peta publik.
- [x] **P2** Validasi data wilayah production dari BIG (2026-07-17, terbukti sudah terpenuhi): sinkronisasi BIG penuh dijalankan 2026-07-12 — 2.640 fitur diambil, 2.640 valid, 0 invalid, status `completed` tercatat di `data_import_runs`; edisi sumber `2020-10` + `source_synced_at` tersimpan di tiap baris; seluruh 2.648 geometri lolos `ST_IsValid`. Sisa non-BIG hanya 8 baris demo (ditandai `manual`, akan terganti saat sinkron ulang).

### 1.2 Data pasang surut & cuaca

- [x] **P1** Integrasikan data pasang surut real/historis (2026-07-18): command `data:fetch-tidal-sealevel` menarik tinggi muka laut per jam dari **Open-Meteo Marine (model pasut FES)** untuk 8 titik stasiun (sinkron dgn `ml-api` STATIONS). Backfill 2 tahun dev & production: **138.048 baris valid**, 8 stasiun terisi. `ml-api` `load_tide_model` kini fit harmonik dari data real (`tide_simulated=False`, fix Decimal→float). Sumber dilabeli jujur: FES model, `provenance_status=unverified` (bukan observasi stasiun BIG/BMKG). Layer stasiun pasut di peta publik kini tampil (8 titik, terverifikasi live).
- [x] **P1** Validasi kualitas tidal (2026-07-18): pipeline `data:fetch-tidal-sealevel` menolak null (2.112 jam kosong terbukti tersaring), outlier |h|>3m, dan duplikat timestamp (index unik `station_code+recorded_at` → upsert idempotent); setiap run tercatat di `data_import_runs` (fetched/valid/invalid/inserted).
- [x] **P2** Jadwal refresh data harian sebelum prediksi ML (2026-07-18): terjadwal berurutan & terverifikasi live di production — `data:fetch-tidal-sealevel` 04:50 → `data:refresh-operational` 05:00 → `ml:predict` 06:00 (semua Asia/Jakarta; ml:predict sendiri via GitHub Actions). Cron Hostinger sudah berdetak sejak 2026-07-16.
- [x] **P3** Refresh prediksi ekstra saat event astronomis (2026-07-18): workflow `ml-predict-astronomical.yml` jalan 16:00 WIB tiap sore tapi `main.py --only-if-astronomical` keluar tanpa aksi kecuali hari dalam jendela pasang purnama/bulan baru (king tide) — murah, otomatis skip hari biasa. *Catatan: pemicu berbasis fase bulan (purnama+bulan baru); perigee sejati (jarak bulan) belum dihitung — cukup untuk pasang purnama, refinement opsional.*
- [x] **P2** Integrasi peringatan dini cuaca BMKG (2026-07-18): banner peta publik kini membaca **prakiraan cuaca resmi BMKG** lebih dulu (bukan derivasi prediksi sendiri). Command `data:fetch-bmkg-warnings` menarik cuaca BMKG per desa pesisir (`region_code` BIG = adm4 Kemendagri, terbukti dikenali BMKG), deteksi cuaca berbahaya (kode 95/97 petir, 65 lebat, 63/80 sedang) → tabel `weather_warnings`, terjadwal tiap 3 jam. `activeWarning()` fallback ke prediksi model hanya bila tak ada peringatan BMKG (dilabeli jelas). Pipa deteksi & banner terverifikasi (7 kabupaten terdeteksi saat ambang uji diturunkan; banner sumber BMKG terbukti dari baris uji).
- [x] **P3** `(keputusan)` Integrasi data gempa/tsunami BMKG — **DIPUTUSKAN TIDAK DIPERLUKAN** (2026-07-18): di luar lingkup prediksi rob (banjir pasang surut); gempa/tsunami adalah domain peringatan BMKG/BPBD terpisah.

### 1.3 Prediksi ML production

- [x] **P1** Validasi `model_version` dan provenance untuk setiap baris prediksi (2026-07-18, terverifikasi sudah terpenuhi): tiap prediksi menyimpan `model_version=flood_classifier_v1`, `data_source`, `provenance_status`; `PredictionResource` + endpoint publik/mode-awam menampilkannya.
- [x] **P1** Handling saat prediksi hari ini belum tersedia (2026-07-18): `PredictionService` kini cari prediksi HARI INI eksplisit + status `fresh`/`stale`/`unavailable` (>30 jam sejak generated_at). Mode Awam menampilkan banner "Prediksi belum diperbarui sejak … WIB"; peta publik `data_freshness` + panel notice. Tidak lagi menampilkan data basi seolah terbaru.
- [~] **P2** Evaluasi akurasi model berkala: precision, recall, drift tracking dari laporan tervalidasi BPBD. **DITUNDA menunggu data (keputusan 2026-07-18)**: production punya 0 laporan tervalidasi (3 total: 2 `perlu_review`, 1 `menunggu`), jadi belum ada ground truth untuk dibandingkan — memaksa metrik dari sampel kosong justru menyesatkan. Catatan penting: model dilatih pakai **label proxy** (ambang tinggi air/pasang), bukan ground truth nyata, jadi metrik training pun optimistis. Evaluasi sejati baru mungkin setelah BPBD memvalidasi laporan banjir nyata (UAT/produksi). Kerjakan `model:evaluate` (bandingkan prediksi vs laporan tervalidasi per lokasi+tanggal, confusion matrix + lead-time) saat ground truth ≥ ~20 laporan.
- [x] **P2** Audit log untuk update model/prediksi (2026-07-18): ml-api mencatat tiap run prediksi ke `data_import_runs` (model_version, data_source, tide_simulated, jumlah, waktu) — fail-safe.
- [x] **P2** Pisahkan seed demo dari data reference (2026-07-18, terverifikasi sudah terpenuhi): `DatabaseSeeder` punya penjaga `if environment('production') return` — `DemoSeeder` tak pernah jalan di production; data reference (wilayah) berasal dari sinkron BIG, bukan seeder. *(Sisa opsional: 8 baris demo legacy di production dari setup awal, ditandai provenance `demo`/boundary `manual` — bisa dibersihkan saat sinkron BIG ulang.)*

---

## Tahap 2 — Melengkapi fungsi backend per fitur

Kerjakan setelah Tahap 1 karena banyak yang bergantung pada data yang benar.

### 2.1 Peta publik (FR-PUB)

- [~] **P1** Layer infrastruktur kritis — **DIBLOKIR menunggu data resmi BPBD (keputusan 2026-07-18)**. Investigasi: OSM punya ~400 fasilitas kesehatan pesisir Lampung (bisa dipakai), tetapi **user memilih menunggu data BPBD resmi** — OSM komunitas tidak otoritatif untuk sistem kebencanaan. Endpoint & shape response (`layers.critical_infrastructure`) sudah ada (FeatureCollection kosong); tinggal isi data + toggle frontend saat data BPBD tersedia.
- [~] **P1** Layer jalur evakuasi — **DIBLOKIR menunggu data resmi BPBD (keputusan 2026-07-18)**. Investigasi: OSM **nihil** (0 titik/jalur evakuasi di pesisir Lampung) — jalur evakuasi resmi hanya ada dari BPBD. Tidak ada cara jujur menyediakan tanpa data itu. Endpoint & shape sudah ada (kosong).
- [x] **P2** Rate limit endpoint publik disetel untuk production (2026-07-18): limiter `public` (default 180/mnt, env `PUBLIC_RATE_LIMIT`) & `public-export` (default 20/mnt, env `PUBLIC_EXPORT_RATE_LIMIT`) di `AppServiceProvider` (aman route:cache), configurable tanpa deploy ulang; default lebih longgar dari sebelumnya karena response ter-cache & banyak warga berbagi IP di balik NAT. Terverifikasi header `X-RateLimit-Limit: 180`.
- [x] **P2** Pantau/cache ukuran response GeoJSON agar peta cepat: `ST_SimplifyPreserveTopology` ~22 m + presisi 5 desimal + cache payload 15 menit — terukur di production 13,5 MB/6,9 dtk → 535 KB/0,33 dtk (2026-07-17). Dev lokal tanpa PostGIS tetap fallback tanpa simplifikasi.

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
- [ ] **P2** Hilangkan dev shortcuts dari build production. *(Keputusan 2026-07-17: DITUNDA — masih dipakai untuk pengujian; situs sudah live publik, jadi wajib dihapus sebelum dipublikasikan luas/UAT eksternal.)*
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

- [ ] **P1** Hapus `backend/check_prob.php` sebelum production (sudah ditandai wajib). *(Catatan 2026-07-17: file ikut ke server via git clone; tidak bisa diakses web karena docroot = `backend/public`, tapi tetap hapus dari repo.)*
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

**Arsitektur final (LIVE sejak 2026-07-16, tanpa VPS)**: Hostinger shared (frontend + Laravel, subdomain `siperah-rob.girimulyo.com`, PHP 8.4) + Supabase free Singapura (PostgreSQL 17 + PostGIS via session pooler) + GitHub Actions (prediksi ML harian 06:00 WIB). Deploy: `bash scripts/deploy-hostinger.sh` (butuh tethering — firewall Hostinger memblokir IP rumah). Detail di memori proyek & `docs/backup-database.md`.

- [ ] **P1** `.env.production` terdokumentasi tanpa secret asli. *(Server sudah punya `.env` production yang benar — `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` valid; tinggal tulis template `.env.production.example` di repo.)*
- [ ] **P1** CORS production hanya mengizinkan domain frontend resmi. *(Urgensi turun: deployment satu-origin + Bearer token, bukan cookie lintas domain — tapi tetap rapikan `config/cors.php`.)*
- [x] **P1** `VITE_API_BASE_URL` production: default `/api` same-origin dipakai (tidak perlu env), tidak ada hardcoded localhost di build production.
- [x] **P1** Cron scheduler aktif: hPanel Cron tiap menit → `schedule:run` (PHP84 + flag pgsql), terverifikasi 2026-07-16. `ml:predict` & `backup:run` sengaja OFF di Hostinger (`ML_SCHEDULE_ENABLED`/`BACKUP_SCHEDULE_ENABLED=false`) — prediksi via GitHub Actions.
- [ ] **P1** Queue worker (dibutuhkan Tahap 4). *(Saat ini `QUEUE_CONNECTION=sync` — cukup sampai notifikasi multi-kanal dikerjakan; di Hostinger nanti pakai database queue + cron `queue:work --stop-when-empty`.)*
- [ ] **P1** Backup otomatis DB + storage foto laporan, dengan retention.
  - *Progres 2026-07-17*: pipeline & panduan selesai (`docs/backup-database.md`) — pg_dump 17 mingguan via GitHub Actions di **repo private** (dump berisi PII warga, dilarang jadi artifact repo public). **Tinggal eksekusi user**: buat repo private `siperah-backups`, salin 5 secrets, tempel workflow, uji sekali. Foto laporan di Hostinger belum ter-backup (unduh berkala via SFTP).
- [x] **P1** Health check endpoint: `/up` bawaan Laravel aktif & terverifikasi 200 di production.
- [x] **P2** Log channel production: `LOG_CHANNEL=daily` + `LOG_LEVEL=warning` di server (retensi default 14 hari).
- [ ] **P2** CI backend: composer install + PHP lint + PHPUnit. CI frontend: npm ci + tsc + build.
- [ ] **P2** Observability minimal: error log terpantau + alert saat scheduler/pipeline gagal. *(Sebagian: workflow Actions gagal = email otomatis dari GitHub ke pemilik repo; log Laravel server belum ada alert.)*
- [ ] **P2** Backup restore drill: latihan restore sekali sebelum go-live (prosedur sudah ditulis di `docs/backup-database.md`).
- [ ] **P3** Load test endpoint peta publik, reports, API research. *(Peta publik sudah dioptimasi 25x + cache 15 menit.)*
- [ ] **P2** Reset password database Supabase (terpapar di riwayat chat 2026-07-16) → update `.env` server + secret `SUPABASE_DB_PASSWORD` di repo utama (dan repo backup bila sudah ada).
- [ ] **P3** Selesaikan blokir IP rumah oleh firewall Hostinger (restart router untuk IP baru / delisting AbuseIPDB) agar SSH tidak butuh tethering.

---

## Tahap 8 — Dokumentasi & serah-terima

- [ ] **P1** Deployment guide — **perlu ditulis ulang**: `docs/deployment_guide.md` yang ada masih menggambarkan arsitektur VPS + Redis + Nginx yang TIDAK jadi dipakai; arsitektur nyata = Hostinger shared + Supabase + GitHub Actions (lihat header Tahap 7 + `scripts/deploy-hostinger.sh` + `docs/backup-database.md`). Sertakan rollback plan (symlink `public_html` bisa dialihkan balik ke `~/apps/siperah-backend` lama).
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
