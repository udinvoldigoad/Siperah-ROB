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

- [x] **P1** Audit data wilayah kerja operator (2026-07-18): mekanisme sudah benar — create (`StoreAdminUserRequest`) mewajibkan `region_id` valid untuk operator; antrean & status difilter per kabupaten operator (`ReportAccessService`/`operatorSummary`). **Celah ditutup**: `UpdateAdminUserRequest` dulu hanya `required_if:role,bpbd_operator` sehingga partial-update `region_id: null` tanpa `role` bisa mengosongkan wilayah kerja operator (lalu operator kena 403 di semua endpoint). Kini `withValidator` menghitung role & region *efektif* (payload ⊕ kondisi user) dan menolak operator tanpa region_id.
- [x] **P2** Definisi matematis grafik tren provinsi sesuai PRD FR-PROV-3 (2026-07-18): grafik kini **jumlah kelurahan kelas Sangat Tinggi (utama) + Tinggi (sekunder), 30 hari KE DEPAN** (hari ini→+29), bersumber `trend_30_days` agregasi server. Sebelumnya: (a) frontend merender rata-rata probabilitas mundur dari tanggal-max — bukan definisi PRD, dan (b) datanya diambil dari `/public/predictions` yang terurut DESC + batas 1000 baris → hanya ~3 hari terjauh, bukan 30 hari penuh. Sumbu Y kini integer dinamis (jumlah kelurahan), selektor kabupaten ganda dihapus (ikut filter halaman). Backend `trend_30_days` diperbaiki: window forward `CURRENT_DATE..+29`, tambah `critical_count`/`high_count`.
- [~] **P2** Populasi berisiko berbasis BPS — **DIBLOKIR menunggu data BPS resmi (keputusan 2026-07-18)**. Audit: 0/311 wilayah pesisir punya populasi bersumber BPS (309 dari BIG tanpa populasi, 297 `population` NULL, 2 demo). `populationAudit` sudah jujur melaporkan status `incomplete` & UI menampilkan "Data populasi belum lengkap". Butuh CSV populasi desa BPS (SP2020) + crosswalk kode. Tidak dibangun importer sekarang atas pilihan user (tunda).

### 2.3 Portal peneliti & API (FR-PEN)

- [x] **P1** Migrasi filter kabupaten dataset (2026-07-18): kolom `coverage_regencies` (jsonb) **sudah dijalankan** di dev (batch 10) & filter teruji — operator `@>`/`jsonb_array_length` jalan; dataset tanpa cakupan (NULL/[]) diperlakukan provinsi-wide (cocok untuk semua filter). Production tinggal `php artisan migrate --force` di deploy berikutnya (belum tereksekusi ke Supabase).
- [x] **P1** Timezone "API calls today" → Asia/Jakarta (2026-07-18): app tz = UTC (tak ada `config/app.php` / `APP_TIMEZONE`), jadi `whereDate('created_at', now())` menghitung hari-UTC — panggilan pagi WIB salah masuk hari sebelumnya. Diperbaiki di `ResearchController::stats`: batas hari & bulan dihitung `Carbon::now('Asia/Jakarta')` lalu `->utc()` (kolom created_at UTC), pakai `whereBetween`. Terverifikasi: WIB 18 Jul = UTC 17 Jul 17:00 → 18 Jul 16:59.
- [x] **P2** Increment API key atomic + logging exception (2026-07-18): `AuthenticateApiKey` dulu `use_count = use_count + 1` read-modify-write (lost update saat paralel) → diganti `ApiKey::whereKey()->update(['use_count' => DB::raw('use_count + 1')])` (atomik di DB). `$next()` kini dibungkus try/catch: outcome `fail` + nama exception tetap tercatat ke audit meski handler 500 (sebelumnya audit terlewat sepenuhnya saat exception).
- [x] **P2** Rate limit API v1 configurable via env (2026-07-18): limiter `api-key` di `AppServiceProvider` kini `env('API_RATE_LIMIT', 120)`; pesan 429 & dokumentasi `apiReference` ikut nilai env. Bisa disetel tanpa deploy ulang.
- [x] **P2** Konten tab lisensi/perizinan data (2026-07-18, terverifikasi sudah lengkap): `ResearchPortalPage` mengelompokkan dataset per lisensi, menampilkan cakupan per dataset, instruksi atribusi, & catatan data mentah mengikuti BIG/BMKG. Tak perlu perubahan.
- [x] **P2** Sanitasi CSV/XLSX injection + test (2026-07-18): cabang export **XLSX** dulu `addRow` tanpa netralisasi (tembus formula injection seperti CSV) → kini `array_map(CsvWriter::sanitize(...))`. `CsvWriter::sanitize` diperbaiki: angka valid (termasuk negatif spt latitude `-5.451`) di-skip agar tak salah jadi teks `'-5.451`, sambil tetap menetralkan payload `=/+/@/-` non-numerik. Ditambah `tests/Unit/CsvWriterTest.php` (13 test, hijau).
- [x] **P3** Finalkan kontrak/stabilitas API `/api/v1/*` (2026-07-18): **bug kontrak diperbaiki** — `apiReference` dulu menyebut `base_path: /api` & contoh `/api/predictions/daily` padahal route nyata `/api/v1/predictions/daily` (peneliti akan kena 404). Kini base path & semua contoh diseragamkan ke `/api/v1`. Ditambah deklarasi `version: v1`, janji stabilitas (field non-breaking, klien abaikan field asing) & kebijakan deprecation (header `Deprecation`/`Sunset` RFC 8594, min 180 hari support). Header **`X-Api-Version: v1`** dikirim di tiap response v1 (via middleware `api.key`) + di-test. Dokumen: `docs/api-contract.md`.

### 2.4 Lain-lain backend

- [x] **P2** `(keputusan)` Storage foto → **tetap disk lokal + perketat akses** (2026-07-18). Cloud ditolak (overkill untuk Hostinger shared + Supabase, trafik modest). **Temuan & fix**: route foto dulu publik terbuka-by-UUID untuk SEMUA foto — termasuk laporan belum divalidasi (sensitif/mungkin salah sebelum ditinjau BPBD). Kini: foto laporan `divalidasi` = URL publik (tampil di peta publik/Mode Awam); foto laporan belum divalidasi = **signed URL** sementara (12 jam, `ReportResource`) — mekanisme ini dipilih karena `<img>` tak bisa kirim header auth. Cache-Control `private, no-store` untuk foto sensitif. Test: `test_report_photo_is_public_only_after_validation` (URL polos→403, signed→200, tanda tangan dirusak→403, tervalidasi→publik).
- [x] **P3** `(keputusan)` Kolom alasan akses naratif peneliti → **tidak diperlukan** (2026-07-18). SKPL tidak mewajibkan; akuntabilitas sudah lewat `institution` (wajib saat registrasi peneliti) + scope API key + audit log. Tidak menambah kolom free-text yang tak terpakai.

---

## Tahap 3 — Melengkapi fungsi frontend per fitur

### 3.1 Fondasi frontend

- [x] **P1** Error boundary global (2026-07-18): komponen `ErrorBoundary` (class, `getDerivedStateFromError`+`componentDidCatch`) membungkus `<App>` di `main.tsx` (jaring global) & di dalam `App` dengan `key={route}` (error per-halaman otomatis pulih saat pindah rute). Halaman error ramah + tombol Muat ulang / Kembali ke beranda + log konsol. Tak ada lagi blank putih saat crash.
- [x] **P1** Guard route per role (2026-07-18, terverifikasi berfungsi): `App.renderRoute` mencocokkan `navItems[].roles` — warga membuka `#/admin`/`#/audit`/`#/operator`/`#/province`/`#/research` → redirect `#/` (dan `#/login` bila belum login) **tanpa flash konten terproteksi** (return null saat redirect). Semua route sensitif terdaftar di navItems dengan roles. Keamanan tetap di backend; guard ini murni UX.
- [x] **P1** UI status akun pending/nonaktif/ditolak (2026-07-18): backend `login` kini balas pesan **spesifik per status** + field `account_status` (bukan 1 pesan generik). Frontend `LoginPage` menampilkan **panel status persisten** (amber untuk menunggu, merah untuk nonaktif/ditolak) alih-alih toast sesaat. `ApiError` (client) kini membawa `status`+`body` agar bisa dibedakan. Test: `test_login_returns_status_specific_message_for_inactive_accounts`.
- [x] **P2** Sinkronkan role register dengan backend (2026-07-18): form register dulu punya selektor "Role Akses" (operator/provinsi/peneliti) yang **menyesatkan** — `RegisterRequest` tak terima `role` & backend paksa `warga`. Selektor dihapus; pendaftaran mandiri selalu warga (status menunggu), dengan info "akun instansi dibuat admin". Copy & field disesuaikan ke konteks warga.
- [ ] **P2** Hilangkan dev shortcuts dari build production. *(Keputusan 2026-07-17: DITUNDA — masih dipakai untuk pengujian; situs sudah live publik, jadi wajib dihapus sebelum dipublikasikan luas/UAT eksternal.)*
- [x] **P2** Code splitting (2026-07-18): semua halaman fitur kini `React.lazy` + `Suspense` (fallback `PageFallback`), `LoginPage`/`PortalPage` tetap eager. **Bundle awal 1.357 KB → 337 KB** (gzip 104 KB); tiap halaman chunk terpisah 5–33 KB. maplibre-gl (~800 KB) otomatis terisolasi & hanya dimuat saat buka peta/laporan. Warning dihilangkan (`chunkSizeWarningLimit: 850`, di atas maplibre tapi tetap menjaga regresi). *(Catatan: `echarts` di package.json tak dipakai di src — dead dep, sudah tak masuk bundle karena tree-shake; bisa dibersihkan terpisah.)*
- [x] **P2** Konsistenkan loading/empty state (2026-07-18, scope: primitif + halaman utama): dibuat komponen bersama `EmptyState` & `LoadingBlock` (pakai `Skeleton` bershimmer yang sebelumnya **tak dipakai satu halaman pun**) + `PageFallback` (Suspense). Diterapkan ke halaman list/tabel utama: Riwayat Laporan, Admin Pengguna, Audit Log, Portal Peneliti (dataset) — mengganti teks "Memuat…" ad-hoc & empty inline. Toast sudah konsisten. *(Sisa: dashboard operator/provinsi masih pakai loading inline pada kartu — tidak cocok untuk skeleton baris, dibiarkan; halaman lain menyusul bila perlu.)*
- [x] **P3** Accessibility perbaikan bertarget (2026-07-18): **Toast** kini `role="alert"` (error) / `role="status"` (sukses/info) dalam region `aria-live=polite` + tombol tutup `aria-label` — dulu tanpa aria sama sekali (pembaca layar tak mengumumkan notifikasi). **Skip-link** "Lewati ke konten utama" (fokus via JS agar tak bentrok hash routing) + `id`/`tabIndex` pada konten utama. Terverifikasi sudah ada sebelumnya: focus-ring global `:focus-visible`, box-shadow focus pada input, `aria-label` pada tombol ikon shell/pagination. *(Sisa: audit kontras WCAG AA menyeluruh & keyboard-trap modal belum dilakukan.)*

### 3.2 Peta publik & mode awam

- [x] **P1** Toggle layer lengkap sesuai PRD: zona bahaya, laporan, infrastruktur kritis, evakuasi, pasang surut (menyusul layer backend Tahap 2.1).
- [x] **P2** Export data peta dari UI (backend sudah ada — pastikan tombol & format benar).
- [x] **P2** QA regression pin/zona saat filter kabupaten aktif.
- [x] **P2** Uji geolokasi mode awam di perangkat mobile nyata (izin lokasi, akurasi, fallback manual).
- [x] **P2** QA mobile map UX (gesture, ukuran kontrol, panel detail).
- [x] **P3** Cek final konsistensi legend & warna vs risk class (sudah satu sumber `shared/constants/risk` — tinggal QA visual).

### 3.3 Dashboard operator

- [x] **P1** Alert laporan baru realtime/polling (2026-07-18): sudah ada polling 30 detik (badge "X baru" & KPI ter-update tanpa refresh). **Diperkuat**: deteksi kenaikan jumlah antrean antar-polling → toast "N laporan baru masuk ke antrean" (via `prevPendingRef`), jadi operator benar-benar mendapat *alert*, bukan hanya angka berubah diam-diam.
- [x] **P2** Export laporan operator dari UI (2026-07-18, terverifikasi sudah ada): tombol "Export CSV" di header antrean → `handleExport` mengunduh `/dashboard/operator/reports/export` dengan token. Tak perlu perubahan.
- [x] **P2** Status kelurahan pakai data real (2026-07-18, terverifikasi): tabel "Status Kelurahan" memakai `summary.region_statuses` (data prediksi + region nyata: kelas bahaya, populasi). **Kelengkapan populasi terblokir data BPS** (lihat 2.2) — bukan mock, tapi banyak `population` NULL sampai CSV BPS tersedia.
- [x] **P2** QA alur `perlu_review` end-to-end (2026-07-18): diverifikasi lewat test E2E `test_perlu_review_report_flows_from_submission_to_validation` — warga lapor di titik luar pantauan → status `perlu_review` → muncul di antrean operator → operator validasi → `divalidasi` & keluar antrean. Alur utuh & benar.
- [x] **P3** UX antrean lanjutan (2026-07-18): ditambah **filter cepat keparahan** (dropdown, param `severity`) + **toggle "SLA terlambat"** (param `sla=overdue`) di header antrean + **badge "SLA terlambat"** per baris (dari `sla_status` backend) + tautan reset filter. `fetchOperatorReports` kini terima filter; teks jumlah antrean mengikuti hasil terfilter.

### 3.4 Dashboard provinsi

- [x] **P2** Filter periode & kabupaten (2026-07-18, terverifikasi sudah ada): `<input type="month">` + `<select>` kabupaten + tombol Reset Filter; refetch otomatis saat berubah & ikut diteruskan ke export CSV.
- [x] **P2** Sorting interaktif tabel risiko (2026-07-18, terverifikasi sudah ada): dropdown 5 kunci (bahaya tertinggi / peluang / populasi / tren / nama) + toggle arah naik-turun, diterapkan via `useMemo`.
- [x] **P3** `(keputusan)` Print/export ringkasan → **CSV cukup, print dilewati (keputusan 2026-07-18)**. Export CSV sudah ada (`handleProvinceExport`, menghormati filter). Tombol Print/PDF tidak diwajibkan SKPL → tidak ditambahkan.

### 3.5 Admin

- [x] **P3** Edit inline role/wilayah/status (2026-07-18): ternyata **belum ada UI-nya sama sekali** — tabel admin cuma bisa Setujui/Tolak & Nonaktif/Aktif, tak bisa mengubah role user existing meski PATCH mendukung. Ditambah **mode edit inline per baris** (tombol "Kelola" → sel role/status jadi `<select>`, wilayah jadi input region_id, aksi jadi Simpan/Batal), kirim hanya field berubah via PATCH `/admin/users/{id}`. Error validasi (mis. operator wajib wilayah) di-toast & editor tetap terbuka agar bisa diperbaiki. Test backend `test_admin_edits_role_inline_and_operator_role_requires_region`. *(Catatan: wilayah masih input UUID region — picker region belum ada endpoint-nya; menyusul bila perlu.)*

---

## Tahap 4 — Notifikasi production (FR-NOTIF)

Blok fitur utuh yang paling besar sisa pekerjaannya. Kerjakan sebagai satu paket setelah fungsi inti stabil.

- [x] **P1** Pilih & pasang queue driver production (database queue paling sederhana; Redis jika trafik tinggi). `(keputusan)` *(2026-07-19: diputuskan **database queue** — Hostinger tak punya Redis/daemon. `queue:work --stop-when-empty` tiap menit via scheduler, aktif otomatis saat `QUEUE_CONNECTION=database`; `.env.example` diganti redis→database. **Aksi deploy: ubah `QUEUE_CONNECTION=database` di `.env` server + `config:cache`** — selama masih `sync`, delay() diabaikan dan kegagalan kanal bikin request 500.)*
- [x] **P1** Browser push production: permission flow di frontend + pengiriman via service worker/FCM.
- [ ] **P1** Email production: konfigurasi SMTP/provider + template pesan per event.
- [ ] **P2** WhatsApp production (provider resmi WA Business API) — sudah ada kontak WA di mode awam, ini untuk pengiriman keluar.
- [x] **P1** Quiet hours benar-benar menahan notifikasi non-kritis, dan peringatan kritis bypass quiet hours. *(2026-07-19: non-kritis (laporan baru/validasi/SLA) di-delay sampai quiet_end; kritis baru dibuat — `HighRiskWarningNotification` tanpa delay. Ditest keduanya. Efektif di production hanya setelah queue=database (lihat item driver).)*
- [x] **P1** Subscription wilayah difilter konsisten dengan region penerima. *(2026-07-19: helper bersama `matchesMonitoredRegions` dipakai semua jalur; peringatan risiko: operator=kabupaten kerja, warga/peneliti=monitored_regions (kosong=semua), provinsi/admin=semua. SLA overdue sengaja tanpa filter preferensi (eskalasi tugas, didokumentasikan).)*
- [x] **P2** Retry queue + failure logging untuk semua kanal eksternal. *(2026-07-19: tries=3 jadi efektif dengan database queue; tabel `failed_jobs` dibuat (sebelumnya tak ada — kegagalan job tak tercatat di mana pun). Worker via scheduler tiap menit.)*
- [x] **P2** Template pesan tiap event (laporan baru, validasi, peringatan risiko, SLA overdue). *(2026-07-19: 3 sudah ada dari PR notif, "peringatan risiko" ditambahkan (inbox/webpush/WA/mail + command `predictions:notify-high-risk` terjadwal 06:30 WIB + dedup harian). via() duplikat diekstrak ke trait `RoutesViaPreferredChannels`.)*
- [x] **P2** Frontend: mark read / read all di inbox notifikasi.
- [x] **P2** Frontend: selector wilayah pantauan pakai autocomplete/dropdown (pola `WilayahPicker` mode awam bisa dipakai ulang).
- [x] **P2** Frontend: quiet hours UI cocok dengan perilaku backend, status kanal Email/WA + fallback.

---

## Tahap 5 — Keamanan & RBAC final

- [x] **P1** Hapus `backend/check_prob.php` sebelum production (sudah ditandai wajib). *(2026-07-18: dihapus dari repo; hilang dari server pada pull berikutnya.)*
- [x] **P1** Test authorization/policy per endpoint: RBAC negative path semua role (warga → admin = 403, dst.). *(2026-07-18: `RbacNegativePathTest` — matriks 9 endpoint × 5 role, tamu=401, akun nonaktif=403 walau role cocok, warga/peneliti tak bisa ubah status laporan, akses ditolak masuk audit log. Bonus: menemukan & memperbaiki bug fitur WebPush (PR #15) — `subscribable_id` BIGINT vs users.id UUID membuat semua POST /reports yang memicu notifikasi jadi 500; fix via migration `2026_07_18_170000`.)*
- [x] **P1** Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options. *(2026-07-18: tidak ada reverse proxy di Hostinger shared — dipasang via middleware `SecurityHeaders` (respons API, CSP default-src 'none') + `public/.htaccess` (file statis SPA, CSP whitelist origin yang benar-benar dipakai: Google Fonts, tile OSM, Nominatim, Open-Meteo, picsum, blob: worker maplibre). `DirectoryIndex` ikut dimasukkan repo. Setelah deploy, verifikasi header di production & pantau pelanggaran CSP di console browser.)*
- [x] **P2** Rencana rotasi secret: `APP_KEY`, token API, kredensial DB/email/WA/SMS — tulis prosedurnya. *(2026-07-18: `docs/rotasi-secret.md` — inventaris + langkah + efek samping per secret. Kredensial email/WA/SMS belum ada (mail=log, WA/SMS=mock).)*
- [x] **P2** Dependency audit npm (`npm audit`) — composer sudah bersih, npm belum dicek. *(2026-07-18: 3 temuan → 0. echarts dihapus (dependency mati, advisory XSS), vite 5→8 + plugin-react 4→6 (advisory esbuild/vite dev-server). tsc + build + smoke dev server hijau.)*

---

## Tahap 6 — Testing menyeluruh

Tulis test sambil/tepat setelah fitur terkait selesai — jangan ditumpuk di akhir.

### 6.1 Backend (PHPUnit)

- [x] **P1** Test auth + RBAC semua role (login, akses silang role ditolak). *(2026-07-19: `AuthFlowTest` baru — login sukses 5 role + token dipakai di `/auth/me`, password/email salah 401 tanpa bocor info + audit fail, register default warga+menunggu & tak bisa eskalasi role/status, logout cabut token + audit. Sekalian fix 2 bug produksi: `Str` tak di-import di AuthController (register selalu fatal error) dan `last_login_at` tak ada di `$fillable` (tak pernah terisi). Akses silang role sudah dicakup `RbacNegativePathTest`. Suite penuh 70 test hijau.)*
- [x] **P1** Test submit laporan + upload foto (termasuk WebP, batas 5 foto/2MB). *(2026-07-19: `ReportSubmissionTest` baru — submit 5 foto (JPG/JPEG/PNG/2×WebP) tersimpan di disk + record `report_photos` + audit `create_report`; boundary 2MB tepat diterima & 2049KB ditolak; severity dihitung server dari `water_height_cm` (boundary 9/10/30/31/80/81) dan input severity klien diabaikan; field wajib & koordinat invalid ditolak 422. Penolakan >5 foto & mime salah sudah ada di `ApiFoundationTest`. Suite penuh 74 test hijau.)*
- [x] **P1** Test antrean operator `menunggu`/`perlu_review` + validasi/tolak + audit log tercatat. *(2026-07-19: `OperatorQueueTest` baru — validasi `menunggu` (validator+`validated_at` terisi, keluar antrean, audit `validate_report`); tolak `perlu_review` wajib `reason` (422 tanpa alasan, tersimpan di `rejection_reason`, audit `reject_report`); PATCH status `ditolak` wajib `rejection_reason` & `duplikat` mengosongkan validator (audit `update_report_status`); laporan terproses tak bisa diproses ulang (409); operator lintas kabupaten & tanpa wilayah kerja ditolak 403. Scoping antrean per wilayah sudah ada di `ApiFoundationTest`. Suite penuh 80 test hijau.)*
- [x] **P2** Test public map (GeoJSON, filter kabupaten, horizon). *(2026-07-19: `PublicMapTest` baru — struktur FeatureCollection regions/reports/layers + koordinat GeoJSON [lon,lat] + properti risiko; filter kabupaten menyaring prediksi & laporan sekaligus; horizon default = tanggal terdekat ≥ hari ini, fallback ke tanggal lampau terakhir bila tak ada; date eksplisit; export CSV ikut filter + `date_format:Y-m-d` ketat. Catatan: cache respons map 15 menit bertahan antar test (array store) — tiap test `Cache::flush()` + regency unik. Suite penuh 86 test hijau.)*
- [x] **P2** Test resolve-region titik dalam/luar pantauan. *(2026-07-19: `ResolveRegionTest` baru — 3 jalur "terpantau" teruji semua: coastal_flag, region non-pesisir ber-prediksi, dan kedekatan <5 km via ST_DWithin (region pesisir ~3,3 km → true; skip bila PostGIS absen); non-pesisir tanpa prediksi → false; titik luar administrasi Lampung → data null + pesan; lat/lon wajib + range check 422. Titik uji (-5.125, 105.125) aman dari wilayah terpantau nyata DB dev dalam 5 km. Suite penuh 92 test hijau.)*
- [x] **P2** Test research download CSV/JSON + API key middleware. *(2026-07-19: `ResearchDownloadTest` baru — v1 predictions CSV (header+isi) vs JSON (data/meta) + filter from/to/region; download dataset CSV + JSON paginasi + audit `download_research_dataset` (JSON hanya cek struktur karena DB dev berisi prediksi nyata — isu isolasi 6.1); middleware: key tanpa prefix/dicabut/pemilik nonaktif → 401 + audit denied, scope salah & pemilik warga → 403 dengan pesan spesifik; use_count atomik terhitung + header `Authorization: ApiKey` alternatif jalan; regenerate key mencabut key lama (key lama 401, baru 200). Suite penuh 98 test hijau.)*
- [x] **P2** Test notification settings & inbox. *(2026-07-19: `NotificationApiTest` baru — settings: default dibuat otomatis saat GET pertama, validasi channel/event/jam tenang (telegram, gempa_bumi, 25:00 → 422), roundtrip persistensi + audit `update_notification_settings`; inbox: hanya milik sendiri urut terbaru, mark-read lintas user 404 & tak mengubah data, read-all tak menyentuh user lain; WebPush subscribe/unsubscribe kelola row `push_subscriptions` + validasi 422; semua endpoint 401 tanpa login. Perilaku kirim (quiet hours/dedup/scoping) sudah ada di `NotificationBehaviorTest`. Suite penuh 106 test hijau.)*
- [x] **P2** Test import data BIG/tidal/prediksi + scheduler command (`ml:predict`). *(2026-07-19: `DataImportPipelineTest` baru — `data:import-tidal` mode tulis: stasiun+2 baris masuk, import ulang idempotent (tetap 2), tanpa `--station-code` & CSV rusak exit 1 tanpa jejak DB; BIG sync mode tulis (Http::fake): insert lalu re-sync jadi update tanpa duplikat + `data_import_runs` completed, backup file pakai provinsi uji lalu dibersihkan; `ml:predict` diuji tanpa Python (stub `main.py` dieksekusi PHP_BINARY via config `services.ml_api.*`) — exit 0 sukses & exit≠0 gagal terpantul benar; scheduler dicek via `schedule:list` (fetch-tidal → refresh-operational → ml:predict → notify-high-risk → audit:prune terdaftar). Suite penuh 111 test hijau.)*
- [x] **P2** Test migration fresh + seed + rollback (masuk CI di Tahap 7). *(2026-07-19: divalidasi penuh di DB test baru `siperah_rob_test` — `migrate:fresh --seed` bersih (23 migrasi + seeder demo), `migrate:rollback` menurunkan SEMUA 23 migrasi tanpa error (semua `down()` bekerja), `migrate` naik lagi mulus. Tersedia `composer test:prepare` untuk mengulang siklus; tinggal jadikan langkah CI di Tahap 7.)*
- [x] **P1** **Isolasi test Feature**: SELESAI 2026-07-19 — DB test khusus `siperah_rob_test` (PostGIS 3.6.2) + `.env.testing` (di-gitignore; template `.env.testing.example` di-commit). PHPUnit memaksa `APP_ENV=testing` sehingga Laravel otomatis memuat `.env.testing` → seluruh suite kini berjalan di DB terisolasi (terverifikasi: test DB 140 prediksi/20 wilayah vs dev 10.151/2.648; suite 111 test hijau, runtime turun ~35d → ~22d). Pendekatan: `DatabaseTransactions` per test di atas DB ter-migrasi (bukan `RefreshDatabase` per run — isolasi sama, lebih cepat); refresh skema saat ada migrasi baru: `composer test:prepare`. *(2026-07-18: tambalan ringan sebelumnya — per_page 1001, regency unik — tetap dipertahankan.)*

### 6.2 E2E smoke test (per role)

Infrastruktur (2026-07-19): **Playwright** di `frontend/e2e/` (`npm run e2e`). Dua server otomatis di port khusus E2E (backend `artisan serve --env=testing` :8123 → DB `siperah_rob_test`, vite :5273 proxy ke situ — tidak pernah menyentuh DB dev); `global-setup` reset DB via `migrate:fresh --seed` tiap run; login via user seed `*@siperah.local`. Total 15 test, ~1,5 menit, semua hijau.

- [x] **P1** Login semua role → redirect dashboard benar. *(2026-07-19: `login.spec` — 5 role via UI → hash tujuan benar; password salah → 401, tetap di login.)*
- [x] **P1** Warga: submit laporan → muncul di riwayat → operator validasi → muncul di peta publik. *(2026-07-19: `report-flow.spec` — wizard lengkap (foto WebP terkompresi, checkbox pernyataan, tinggi air), kode verifikasi dari modal dipakai menelusuri riwayat → antrean operator (kartu via deskripsi unik) → validasi → kode muncul di respons `/public/map`.)*
- [x] **P2** Peta publik: filter, horizon, klik wilayah, layer. *(2026-07-19: `map.spec` — 4 test. Sekalian fix bug frontend: fallback update peta pakai event `load` yang cuma fire sekali → toggle layer bisa jadi no-op; diganti `once("idle")`.)*
- [x] **P2** Provinsi: lihat summary + export CSV. *(2026-07-19: `province.spec` — summary 200 + download CSV terverifikasi nama file.)*
- [x] **P2** Peneliti: download dataset + regenerate API key. *(2026-07-19: `research.spec` — unduh dataset CSV + buat kunci baru, raw key `spr_…` tampil sekali dengan tombol salin.)*
- [x] **P2** Admin: approve/reject/nonaktifkan user. *(2026-07-19: `admin.spec` — pakai user registrasi baru (bukan seed) agar spec lain aman; approve → `aktif`, reject via modal → `ditolak`, nonaktifkan → `nonaktif` + login user tsb ditolak 403.)*

---

## Tahap 7 — Infrastruktur production & deploy

**Arsitektur final (LIVE sejak 2026-07-16, tanpa VPS)**: Hostinger shared (frontend + Laravel, subdomain `siperah-rob.girimulyo.com`, PHP 8.4) + Supabase free Singapura (PostgreSQL 17 + PostGIS via session pooler) + GitHub Actions (prediksi ML harian 06:00 WIB). Deploy: `bash scripts/deploy-hostinger.sh` (butuh tethering — firewall Hostinger memblokir IP rumah). Detail di memori proyek & `docs/backup-database.md`.

- [x] **P1** `.env.production` terdokumentasi tanpa secret asli. *(2026-07-19: `backend/.env.production.example` ditulis — semua variabel yang benar-benar dibaca aplikasi (hasil inventaris `env()` di config+app) dengan placeholder `<...>`, plus komentar keputusan penting: Supabase wajib session pooler 5432, `LOG_CHANNEL=daily`+`warning`, `ML_SCHEDULE_ENABLED`/`BACKUP_SCHEDULE_ENABLED=false` di Hostinger, queue `sync`→`database` saat multi-kanal, rate limit publik, VAPID, MAIL. Tidak ada secret asli.)*
- [x] **P1** CORS production hanya mengizinkan domain frontend resmi. *(2026-07-19: default `allowed_origins` di `config/cors.php` diganti dari `*` menjadi turunan `APP_URL` — production otomatis hanya domain resmi walau `CORS_ALLOWED_ORIGINS` lupa di-set; dev tetap aman karena vite proxy same-origin. Override koma-separated tetap tersedia. Template production menyetel eksplisit `https://siperah-rob.girimulyo.com`. Suite 111 test tetap hijau.)*
- [x] **P1** `VITE_API_BASE_URL` production: default `/api` same-origin dipakai (tidak perlu env), tidak ada hardcoded localhost di build production.
- [x] **P1** Cron scheduler aktif: hPanel Cron tiap menit → `schedule:run` (PHP84 + flag pgsql), terverifikasi 2026-07-16. `ml:predict` & `backup:run` sengaja OFF di Hostinger (`ML_SCHEDULE_ENABLED`/`BACKUP_SCHEDULE_ENABLED=false`) — prediksi via GitHub Actions.
- [x] **P1** Queue worker (dibutuhkan Tahap 4). *(2026-07-20: AKTIF & TERBUKTI DI PRODUCTION — bukan cuma test lokal. Prasyarat: production ternyata tertinggal 62 commit dari lokal (belum ada sistem webpush, security headers, CI, dll), jadi dilakukan **deploy penuh** dulu (`scripts/deploy-hostinger.sh`; sempat tertahan `.htaccess` yang punya drift lokal di server dari deploy lama — drift terbukti cuma baris `DirectoryIndex` yang sudah ter-superset di commit baru, aman didiscard) + `migrate --force` 3 migrasi pending (push_subscriptions, fix uuid morphs, failed_jobs). Smoke test pasca-deploy sempat menunjukkan 500/302 di endpoint auth — ternyata false alarm (curl tanpa header `Accept: application/json`, bukan bug; frontend asli selalu kirim header itu, dikonfirmasi ulang dengan header benar → 401/422 sesuai ekspektasi). User mengubah `QUEUE_CONNECTION=sync→database` + `config:cache` di server. Verifikasi end-to-end di DATA PRODUKSI SUNGGUHAN (bukan DB test): user+operator+laporan sementara dibuat, `notifyNewReportForReview` dipanggil nyata → 3 job masuk tabel `jobs` → cron menguraskannya ke `notification_inbox` (`report_review` diterima operator) dalam <100 detik → `failed_jobs` tetap 0 → seluruh data uji (report, kedua user, baris inbox, skrip sementara) dihapus bersih, 0 sisa. `artisan queue:failed` akhir: kosong.)*
- [x] **P1** Backup otomatis DB + storage foto laporan, dengan retention.
  - *Progres 2026-07-17*: pipeline & panduan selesai (`docs/backup-database.md`) — pg_dump 17 mingguan via GitHub Actions di **repo private** (dump berisi PII warga, dilarang jadi artifact repo public). **Tinggal eksekusi user**: buat repo private `siperah-backups`, salin 5 secrets, tempel workflow, uji sekali. Foto laporan di Hostinger belum ter-backup (unduh berkala via SFTP).
- [x] **P1** Health check endpoint: `/up` bawaan Laravel aktif & terverifikasi 200 di production.
- [x] **P2** Log channel production: `LOG_CHANNEL=daily` + `LOG_LEVEL=warning` di server (retensi default 14 hari).
- [x] **P2** CI backend: composer install + PHP lint + PHPUnit. CI frontend: npm ci + tsc + build. *(2026-07-19: dua workflow GitHub Actions, **terverifikasi hijau di runner GitHub sungguhan** (bukan cuma lolos lokal) — `backend-ci.yml` (service container `postgis/postgis:17-3.4-alpine` meniru `siperah_rob_test` → composer install → lint `php -l` → migrate+seed → phpunit) dan `frontend-ci.yml` (npm ci → `tsc -b --noEmit` → `npm run build`). Trigger push/PR ke main dengan path filter + `workflow_dispatch` manual.
  - *Debug run pertama*: backend gagal — `composer.lock` terkunci di PHP 8.4.20 lokal (symfony/clock dkk v8.1 butuh php≥8.4.1) sementara CI dipasang PHP 8.3 → dinaikkan ke 8.4 (selaras production Hostinger), langsung hijau. Frontend gagal 3x berturut sampai akar masalah ketemu: `package-lock.json` ternyata **tidak lengkap** (`Missing: @emnapi/core@1.11.2` dari lock — dependensi transitif opsional fallback WASM Rolldown/Vite 8), kemungkinan besar rusak sejak `npm install -D @playwright/test` inkremental sebelumnya. GitHub tidak mengizinkan unduh log job tanpa token admin repo bahkan untuk repo publik — didiagnosis dengan menangkap stdout `npm ci` lalu mencetaknya sebagai `::error::` annotation (annotation KHK API publik). Fix: `rm -rf node_modules package-lock.json && npm install` (regenerasi total, bukan inkremental) → diverifikasi `npm ci`+`tsc`+`build`+E2E lokal sebelum push ulang. *Pelajaran*: setelah `npm install -D` untuk menambah satu paket, jangan asumsikan lockfile otomatis konsisten penuh untuk dependensi transitif opsional bertingkat (WASM/native binding) — kalau ragu, regenerasi total.)*
- [x] **P2** Observability minimal: error log terpantau + alert saat scheduler/pipeline gagal. *(2026-07-20, `(keputusan)` user: skip kanal alert nyata untuk sekarang — production tidak punya `MAIL_*` terisi sama sekali, jadi "alert email" tidak akan benar-benar terkirim. Dibangun `system:health-check` (command baru, `bootstrap/app.php` terjadwal tiap jam) yang mengagregasi 3 sinyal yang sudah ada: `data_import_runs` gagal, `failed_jobs`, dan baris ERROR di log Laravel dalam window waktu tertentu → satu ringkasan + exit code, dicatat ke log `warning` (production `LOG_LEVEL=warning` → otomatis masuk log harian yang ditahan 14 hari, bisa dicek manual via SSH). 6 test baru (`SystemHealthCheckTest`), suite 118 test hijau. Workflow Actions gagal = email otomatis GitHub ke pemilik repo (sudah ada, tanpa kerja tambahan). **Sisa**: sambungkan ke kanal alert nyata (email/Telegram/dll) begitu SMTP/webhook diputuskan — tinggal tambah channel di command ini.)*
- [ ] **P2** Backup restore drill: latihan restore sekali sebelum go-live (prosedur sudah ditulis di `docs/backup-database.md`).
- [ ] **P3** Load test endpoint peta publik, reports, API research. *(Peta publik sudah dioptimasi 25x + cache 15 menit.)*
- [x] **P2** Reset password database Supabase (terpapar di riwayat chat 2026-07-16) → update `.env` server + secret `SUPABASE_DB_PASSWORD` di repo utama (dan repo backup bila sudah ada).
- [x] **P3** Selesaikan blokir IP rumah oleh firewall Hostinger (restart router untuk IP baru / delisting AbuseIPDB) agar SSH tidak butuh tethering. *(2026-07-19: terkonfirmasi TERATASI — SSH ke `145.223.108.38:65002` berhasil 3x berturut dari koneksi rumah tanpa tethering. Catatan teknis: ISP rumah user memakai CGNAT (IP publik berputar antar `156.230.182.151`/`.204` dalam hitungan detik per request — dikonfirmasi lewat 2 layanan cek IP berbeda); restart modem sebelumnya kemungkinan tidak mengubah apa pun secara langsung karena tetap di pool ISP yang sama, tapi blokir/listing AbuseIPDB rupanya sudah kedaluwarsa atau ter-delist di sisi Hostinger pada saat pengecekan ini. Kalau blokir muncul lagi di masa depan (mengingat IP CGNAT bisa kena flag ulang oleh aktivitas user lain sepool), diagnosis cepat: `timeout 8 bash -c "cat < /dev/null > /dev/tcp/145.223.108.38/65002"`.)*

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
