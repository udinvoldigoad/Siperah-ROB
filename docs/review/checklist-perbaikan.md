# 🔧 Checklist Perbaikan Lanjutan — SIPERAH-RoB

> **Dibuat:** 2026-07-29 · **39 temuan** · Semua rujukan `file:baris` sudah dibuka & diverifikasi.
> **Cakupan:** kode mati, bug, logika bisnis, UI tak konsisten, perawatan, data.
> **Dokumen tunggal.** Sejak 2026-07-29 file ini menggantikan `audit-perbaikan.md` (audit 2026-07-26), yang sudah dihapus. Item terbukanya diperiksa ulang terhadap kode hari ini lalu dipindahkan ke [§8](#8--warisan-audit-2026-07-26); yang tidak dipindahkan beserta alasannya ada di [§8.6](#86-yang-digugurkan-dan-alasannya).

---

## Cara memakai

1. Centang `- [ ]` → `- [x]` saat selesai.
2. Tulis hash commit di akhir baris, contoh: `✅ a1b2c3d`.
3. Kalau sebuah item **sengaja tidak dikerjakan**, jangan dihapus — tandai `*(DITUNDA — alasan)*` supaya keputusannya terekam.
4. Perbarui tabel [Ringkasan](#ringkasan) saat ada yang berubah.

**Severity:** 🔴 tinggi (berdampak ke pengguna sekarang) · 🟠 sedang (utang teknis nyata) · 🟡 rendah (kerapian)

**Kolom "Bukti":** `kode` = dibaca langsung dari sumber · `produksi` = diverifikasi di server/DB produksi

---

## Ringkasan

| # | Kategori | 🔴 | 🟠 | 🟡 | Total | Selesai |
|---|---|---|---|---|---|---|
| 1 | [Produksi — butuh keputusan](#1--produksi--butuh-keputusan) |✅|
| 2 | [Kode mati & sisa peralihan](#2--kode-mati--sisa-peralihan) |✅|
| 3 | [Logika bisnis](#3--logika-bisnis) |✅|
| 4 | [UI tidak konsisten](#4--ui-tidak-konsisten) |✅|
| 5 | [Perawatan & struktur](#5--perawatan--struktur) |✅|
| 6 | [Test & tooling](#6--test--tooling) |✅|
| 7 | [Data & skema](#7--data--skema) |✅|
| 8 | [Warisan audit 2026-07-26](#8--warisan-audit-2026-07-26) | 0 | 12 | 6 | 18 | **4** |

---

## 1. 🚨 Produksi — butuh keputusan

Dua item ini menyangkut server yang sedang berjalan, bukan kode. Keduanya butuh persetujuan sebelum dieksekusi.

- [x] 🔴 **`PR-1` — Kunci VAPID produksi tercemar, push browser mati sejak 27 Juli** — ✅ *diperbaiki 2026-07-29 di server; pencegahannya masuk repo*
  **Diagnosis akhir:** kuncinya **tidak pernah rusak maupun hilang**. Baris `.env` kehilangan newline sehingga dua variabel menyatu:
  `VAPID_PRIVATE_KEY=<43 char>VAPID_SUBJECT=https://siperah-rob.girimulyo.com` — persis 90 karakter, mengandung `=` dan `/`, sehingga `Base64Url::decode()` menolaknya di `VAPID.php:89` dan **setiap** push gagal.
  **Dibuktikan:** 43 karakter pertama didekode jadi 32 byte, dan kunci publik yang diturunkan darinya **cocok** dengan yang terpasang — jadi baris cukup dipisah kembali, tanpa regenerasi.
  **Dugaan awal yang meleset:** dokumen ini sempat menulis bahwa perbaikan akan membatalkan semua langganan push. Keliru dua kali — regenerasi tak diperlukan, dan langganan terdaftar ternyata **0**.
  **Pencegahan:** `system:health-check` kini memeriksa *bentuk* ketiga variabel (bukan sekadar terisi), dan `.env.example` mendokumentasikannya. Ditutup `VapidHealthCheckTest` (6 tes).

- [x] 🟡 **`PR-2` — Entri bernama backslash di `backend/` server** — ✅ *dibersihkan 2026-07-29; penjaga masuk skrip deploy*
  Letaknya bukan di dalam docroot seperti dugaan awal: keduanya berada di `backend/` dengan backslash sebagai **bagian dari nama berkas** (`public\assets`, `public\index.html`), sisa unggahan berpath Windows. Isinya 41 aset build basi, **2,5 MB**, tertanggal 26 Juli.
  Apache tak pernah menyajikannya (docroot = `backend/public/`), jadi kesalahannya tak menimbulkan gejala apa pun — baru ketahuan berbulan kemudian lewat `git status`.
  **Pencegahan:** `scripts/deploy-hostinger.sh` kini menggagalkan deploy bila entri semacam itu muncul lagi setelah unggahan. Diuji dua arah: lolos saat bersih, menangkap saat entri palsu ditanam.
  **Catatan:** seluruh deploy 29 Juli hanya menghasilkan path yang benar, jadi skrip yang sekarang memang bukan penyebabnya.

---

## 2. 🧹 Kode mati & sisa peralihan

Sisa dari penyederhanaan peran 5→3 dan perubahan alur pendaftaran.

- [x] 🟠 **`KM-1` — `phone_number` divalidasi & ditampilkan, tapi tak ada satu pun form yang mengisinya** — ✅ *dibuang seluruhnya 2026-07-29*
  Dibuang dari 7 titik kode (2 request, resource, `$fillable`, 2 controller, seeder), `schema.sql`, dan ERD; kolom DB-nya dihapus lewat migrasi idempoten.
  **Aman:** di produksi hanya 5 baris terisi, semuanya akun demo `@siperah.local` dengan nomor placeholder seeder — tidak ada pengguna sungguhan yang punya nomor.
  **Catatan:** ini mengubah bentuk respons `UserResource` (breaking), diambil setelah dipastikan frontend tak pernah membacanya dan endpoint publik `/api/v1/*` tak memakai resource ini.

- [x] 🟡 **`KM-2` — Akun seed `operator@` & `provinsi@` menyandang nama peran yang sudah dihapus** — ✅ *dihapus 2026-07-29*
  Keduanya dibuang dari seeder, `SEED_USERS`, dan pintasan DEV di halaman login. Yang tersisa: satu akun per peran nyata (`warga`/`peneliti`/`admin`) plus `admin2` (`demo@siperah.local`, sebelumnya "Demo Super User") yang ada **semata** untuk memberi spec email admin kedua — limiter login 10/menit per (email + IP) jadi tak tertabrak antar-spec.
  **Ikutan yang tak tercatat di temuan:** `$validatorId` seeder laporan menunjuk UUID `operator@`; kalau akunnya dibuang tanpa itu, seed laporan `divalidasi` melanggar FK. Kini menunjuk admin. Spec `province` pindah ke `admin2`, `report-flow` ke `admin` — aman karena `ReportAccessService::accessible()` cabang `admin` tidak menyaring per wilayah.
  **Belum dikerjakan — produksi:** `operator@` & `provinsi@` masih ada di sana (lihat `DT-4`).

- [x] 🟡 **`KM-3` — Header progres `audit-perbaikan.md` basi & seluruhnya dikomentari HTML** — ✅ *file dihapus 2026-07-29, isinya dilebur ke [§8](#8--warisan-audit-2026-07-26)*
  Bukan sekadar headernya yang basi: **70% isi dokumen** dibungkus `<!-- -->`, sehingga sebagian besar temuan tak pernah terlihat saat dirender. Memperbarui angkanya saja tak akan memperbaiki itu.
  Ke-26 item terbukanya dibuka ulang terhadap kode hari ini — 5 gugur, 21 dipindahkan (jadi 18 entri `AU-*`). Alasan tiap yang gugur tercatat di [§8.6](#86-yang-digugurkan-dan-alasannya).

- [x] 🟡 **`KM-4` — 59 pemakaian `any` di frontend** — ✅ *59 → **0**, 2026-07-29*
  **27 `catch (err: any)`** → `catch (err: unknown)` + helper `errorMessage(err, fallback)` di `shared/api/client.ts`. Pola lama `err.message || "…"` diam-diam menghasilkan pesan kosong bila yang terlempar bukan `Error`; helper-nya membuat kasus itu jatuh ke fallback.
  **6 `Variants: any`** → `type Variants` framer-motion (pola yang sudah dipakai 4 berkas lain). **`ApiError.body`** kini `ApiErrorBody` — tiga field yang benar-benar dipakai bercabang diketik eksplisit, sisanya `unknown`. **13 di `CitizenModePage`** hilang lewat satu tipe `CitizenModeViewProps`; begitu props-nya terketik, 6 callback `.map()` ikut tersimpul sendiri. **6 di `PublicMapPage`** → tipe GeoJSON asli; dua cast `as any` disatukan jadi satu konversi ber-`unknown` yang terdokumentasi di batas jaringan.
  **Temuan sampingan:** `region.provenance_status` memang dikirim `PublicMapController::modeAwam` tapi absen dari tipenya, jadi pembacanya terpaksa `as any` — tipenya yang salah, bukan datanya. Dua `const res: any = await api(...)` di `ForgotPasswordPage` ternyata tak pernah dibaca sama sekali.
  **Batas atasnya dijaga:** `npm run check:any` (skrip tanpa dependensi, batas **0**) berjalan di `frontend-ci.yml` setelah `tsc` — sebab `tsc` justru tak bisa menangkap ini, `any` bekerja dengan mematikan pemeriksaan tipe. Diuji dua arah: menolak `any` yang ditanam, dan meloloskannya bila ditandai `/* any-ok: alasan */`.
  **Sisa yang sengaja dibiarkan:** tak ada. Dedup JSX `CitizenModeDesktop`/`Mobile` tetap terbuka sebagai [`AU-15`](#85-testing--refactor-yang-ditunda) — itu duplikasi, bukan tipe.

---

## 3. 🧠 Logika bisnis

- [x] 🟠 **`LB-2` — Dua konsep "tujuan" hidup berdampingan tanpa saling tahu** — ✅ *disatukan 2026-07-29; izin kini diminta sekali saat akun dibuat*
  **Keputusan pemilik:** izinnya cukup diminta saat pendaftaran; pembuatan kunci API tidak perlu izin kedua. Jadi bukan "tampilkan sebagai konteks" seperti usulan awal — salah satu konsepnya dihapus.
  Alur `api_access_requests` dibuang seluruhnya: model, 5 route, 2 endpoint controller, notifikasi hasil tinjauan, form pengajuan di portal peneliti, modal tinjau di admin, dan tabelnya (migrasi penghapus). **Aman:** di produksi tabel itu berisi **0 baris** dan **0 kunci API** pernah dibuat — diperiksa langsung ke DB produksi sebelum migrasi ditulis.
  **Yang menjaga sekarang tinggal satu, dan itu memang cukup:** pendaftaran peneliti mewajibkan `research_purpose` dan lahir berstatus `menunggu`; login menolak akun yang belum `aktif`. Jadi setiap peneliti yang sampai ke tombol "Buat Kunci" sudah pernah ditinjau admin. Dikunci `ApiKeyAccessGateTest` (5 tes) — termasuk penjaga bahwa endpoint izin lama benar-benar 404, dan bahwa peneliti `menunggu` tak pernah mendapat token sama sekali (kalau gerbang login itu bocor, seluruh alasan menghapus izin kedua ikut gugur).
  **Tampilan admin ikut dirapikan** sesuai permintaan: banner "pendaftaran baru" dan panel "permohonan akses API" — dua antrean yang menanyakan hal serupa di layar berbeda — digabung jadi satu bagian **Perizinan akun**, menyebut berapa di antaranya permohonan peneliti yang membawa alasan tertulis. Tombolnya menyaring tabel yang sudah ada ke antrean `menunggu`, bukan membuka daftar kedua: aksi "Tinjau Permohonan" per baris sudah menampilkan alasan pemohon.

- [x] 🟠 **`LB-4` — `GroundTruthReport` tanpa SoftDeletes, padahal `User` memakainya** — `backend/app/Models/GroundTruthReport.php:9` vs `backend/app/Models/User.php:14` *(bukti: kode)*
  Laporan terhapus **permanen**. Akun bisa dipulihkan, laporannya tidak — padahal laporan adalah bukti lapangan yang menopang validasi dan jejak audit. Ini juga akar 45 job antrean gagal di produksi (sudah diredam di `8d9e225` dengan berhenti membawa model ke antrean, tapi penghapusannya sendiri tetap permanen).
  **Aksi:** tambahkan SoftDeletes + kolom `deleted_at`, atau putuskan secara sadar bahwa penghapusan laporan memang final dan catat alasannya.

- [x] 🟡 **`LB-5` — `permission_workflow.status` menduplikasi `status` di level atas** — `backend/app/Http/Resources/UserResource.php:19,32` *(bukti: kode)*
  Nilai yang sama dikirim dua kali dalam satu objek. Tidak berbahaya, tapi dua sumber untuk satu fakta selalu berisiko berbeda saat salah satunya diubah.
  **Aksi:** buang yang di dalam `permission_workflow`.

---

## 4. 🎨 UI tidak konsisten

- [x] 🟡 **`UI-2` — Ratusan warna heksadesimal hardcoded di luar token CSS** — `frontend/src/app/PortalPage.tsx` (82), `features/research/ResearchPortalPage.tsx` (39), `features/public-map/OnboardingPage.tsx` (31) *(bukti: kode)*
  Warna yang ditulis langsung tidak ikut berubah saat tema gelap aktif. Audit sebelumnya sudah menemukan token yang hilang menyebabkan dark mode mati; ini sumber masalah yang sejenis dan belum tersentuh.
  **Aksi:** pindahkan ke variabel di `shared/styles/tokens.css`, dahulukan `PortalPage` karena itu halaman pertama yang dilihat tamu.

---

## 5. 🏗️ Perawatan & struktur

- [x] 🟠 **`MT-1` — `AdminUsersPage.tsx` 1.514 baris** — `frontend/src/features/admin/AdminUsersPage.tsx` *(bukti: kode)*
  File terbesar di frontend. Memuat 4 modal (tambah pengguna, tinjau izin API, kelola pengguna, tinjau permohonan peneliti), 2 komponen dropdown, tabel, filter, paginasi, dan seluruh CSS-nya dalam satu berkas.
  **Aksi:** pisahkan tiap modal ke berkasnya sendiri; `RowActionsMenu` & `RegionCombobox` layak naik ke `shared/components`.

- [x] 🟠 **`MT-2` — Controller gemuk: `PublicMapController` 730 baris, `ResearchController` 693** — `backend/app/Http/Controllers/Api/` *(bukti: kode)*
  Keduanya melebihi `DashboardController` (507) yang sudah ditandai kegemukan di audit sebelumnya.
  **Aksi:** tarik logika kueri ke service, samakan polanya dengan `ReportAccessService`.

- [x] 🟠 **`MT-3` — Dua normalisasi nama wilayah yang berdiri sendiri-sendiri** — `backend/app/Http/Controllers/Api/DashboardController.php:503` & `backend/app/Services/NotificationService.php` (`matchesMonitoredRegions`) *(bukti: kode)* ✅ `b690e99`
  Keduanya sama-sama membuang prefiks "Kabupaten/Kota" agar "Bandar Lampung" cocok dengan "Kota Bandar Lampung", tapi ditulis terpisah. Kalau satu diperbaiki dan yang lain tidak, notifikasi dan dashboard akan diam-diam menyaring wilayah secara berbeda — kegagalan yang tak menimbulkan error, hanya data yang hilang.
  **Aksi:** satukan jadi satu helper (mis. `App\Support\RegionName`) dan pakai di kedua tempat.

---

## 6. 🧪 Test & tooling

- [x] 🟠 **`TS-1` — Tak ada cara cepat menguji pengiriman email** — `backend/app/Console/Commands/SendTestNotification.php` *(bukti: kode)*
  `php artisan notify:test <email>` hanya mengirim `TestPushNotification` yang kanalnya push saja. Saat memperbaiki kanal email, tidak ada perintah untuk membuktikan SMTP produksi benar-benar jalan tanpa memicu kejadian sungguhan.
  **Aksi:** tambahkan opsi `--mail` yang mengirim notifikasi uji lewat kanal mail. ✅ `b690e99`

---

## 7. 🗄️ Data & skema

- [x] 🟠 **`DT-1` — Baris `notification_settings` yatim tak pernah dibersihkan** — *(bukti: produksi)*
  Di produksi ada **7 baris pengaturan untuk 4 akun aktif** — 3 sisanya milik akun yang sudah dihapus. Tidak ada cascade maupun pembersihan.
  **Aksi:** tambahkan `on delete cascade` pada FK `user_id`, atau bersihkan saat akun dihapus permanen. ✅ `c8f77fa`

- [x] 🟡 **`DT-2` — Batas panjang `research_purpose` hanya ada di request** — `backend/database/migrations/2026_07_29_000001_add_research_purpose_to_users.php` *(bukti: kode)*
  Kolomnya `text` tanpa batas; `max:1000` hanya dijaga `RegisterRequest`. Jalur lain yang menulis kolom ini di kemudian hari tidak akan terjaga.
  **Aksi:** *(cukup disadari)* — satu-satunya jalur tulis adalah RegisterRequest.

- [x] 🟡 **`DT-3` — `catch {}` menelan galat parse JSON di klien API** — `frontend/src/shared/api/client.ts:57` *(bukti: kode)*
  Kalau respons galat bukan JSON (mis. halaman error HTML dari server), badannya dibuang diam-diam dan pengguna hanya melihat pesan generik. Sengaja fail-safe, tapi menyulitkan diagnosa persis saat paling dibutuhkan.
  **Aksi:** tetap jangan melempar, tapi `console.debug` badan mentahnya saat `import.meta.env.DEV`.

- [x] 🟡 **`DT-4` — Akun demo `operator@` & `provinsi@` masih hidup di produksi** — *(bukti: produksi)*
  `KM-2` membuangnya dari seeder, tapi seeder memakai `updateOrInsert` — baris yang sudah ada tidak ikut terhapus. Keduanya masih **aktif berperan `admin`** di produksi (login terakhir 28 & 27 Juli), artinya kredensial demo berpassword `password` masih bisa masuk sebagai admin.
  **Diperiksa langsung ke DB produksi:** keduanya tidak memiliki laporan, validasi, maupun kunci API — hanya 1 & 4 baris `audit_logs` dan 1 baris `notification_settings` masing-masing.
  **Aksi:** hapus manual via `php artisan accounting:clean-demo`. `audit_logs.actor_user_id` di-null-kan dulu, lalu cascade menghapus sisanya. Belum dieksekusi: jalankan di server produksi dengan `--dry-run` dulu.

---

## 8. 📦 Warisan audit 2026-07-26

Dokumen `audit-perbaikan.md` **dihapus** pada 2026-07-29 — isinya sudah 70% terkomentari HTML sehingga tak terbaca saat dirender, dan header progresnya berhenti di angka yang basi. Item yang masih terbuka **dibuka ulang satu per satu terhadap kode hari ini**, lalu yang bertahan dipindahkan ke bawah ini.

**26 item terbuka → 5 digugurkan, 21 dipindahkan** (menjadi 18 entri: beberapa temuan bertetangga disatukan, mis. tiga tes rapuh jadi satu `AU-18`). Yang digugurkan dicatat di [§8.6](#86-yang-digugurkan-dan-alasannya) supaya keputusannya tidak ikut hilang bersama filenya.

### 8.1 Korektness pipeline ML

- [x] 🟠 **`AU-1` — Wilayah tanpa data spasial diperlakukan sebagai wilayah paling berbahaya** — `ml-api/main.py:415-427` *(bukti: kode)* ✅ `a5b23c7`
  `distance_to_coast_m` dan `avg_elevation_m` yang `NULL` dibaca sebagai `0.0`, sehingga `spatial_factor = exp(0) × exp(0) = 1.0` — nilai **maksimum**. Wilayah yang datanya belum terisi jadi tampak lebih berisiko daripada wilayah pesisir berelevasi rendah yang datanya lengkap. Ini kebalikan dari yang dimaksud, dan keluarannya adalah peringatan banjir yang dibaca warga.
  **Aksi:** bedakan "nol yang valid" dari "data hilang" — lewati wilayahnya, atau pakai faktor konservatif yang eksplisit dan tandai `provenance_status`.

- [x] 🟠 **`AU-2` — `confidence_score` tidak sejalan dengan `risk_probability`** — `ml-api/main.py:437-445` *(bukti: kode)* ✅ `95728c6`
  `risk_probability` dihitung dari `final_prob` (sudah dikali `spatial_factor`), tetapi `confidence_score` diambil apa adanya dari `row["confidence"]` milik probabilitas **mentah**. Hasilnya bisa terbaca "risiko rendah 4%" berdampingan dengan "keyakinan 80%" — dua angka yang menjelaskan hal berbeda tapi disajikan sebagai satu kesatuan.
  **Aksi:** hitung ulang keyakinan dari `final_prob`, atau pisahkan penamaannya agar jelas mereka mengukur hal berbeda.

- [x] 🟠 **`AU-3` — Dua command Artisan memakai nama `ml:predict` yang sama** — `backend/app/Console/Commands/RunMlPrediction.php:10` & `RunMlPredictions.php:10` *(bukti: kode)* ✅ `39ae79c`
  Keduanya mendaftarkan signature `ml:predict`; yang menang bergantung urutan pendaftaran, jadi salah satunya dead code dan cron bisa memanggil yang bukan dimaksud. Opsi `--simulate` milik `RunMlPrediction` tidak dikenal argparse `main.py`.
  **Aksi:** hapus atau ganti nama salah satu, lalu pastikan cron memanggil yang tersisa.

- [ ] 🟡 **`AU-4` — Type hint `RandomForestClassifier` padahal modelnya XGBoost** — `ml-api/files/train_model.py:119,158,170` *(bukti: kode)*
  Impor-nya tak ada (anotasi Python malas dievaluasi, jadi tak crash), dan docstring di baris 6 juga masih menulis RandomForest sementara baris 90 membangun `XGBClassifier`. Menyesatkan pembaca — termasuk penguji skripsi.
  **Aksi:** ganti ke `XGBClassifier` dan selaraskan docstring.

### 8.2 Korektness backend

- [x] 🟠 **`AU-5` — Aksi validasi/tolak/ubah-status laporan tanpa penguncian** — `backend/app/Http/Controllers/Api/ReportController.php:231,251,272` *(bukti: kode)* ✅ `ce38094`
  `authorizeReview()` memeriksa status lalu `update()` menulisnya — non-atomik. Dua admin (atau satu double-click) sama-sama lolos pemeriksaan, keduanya menulis, dan pelapor menerima **notifikasi ganda** yang bisa saling bertentangan.
  **Aksi:** bungkus `DB::transaction` + `lockForUpdate`, atau jadikan update kondisional (`where('status', ...)`) dan tolak bila 0 baris terpengaruh.

- [x] 🟠 **`AU-6` — Callback Google menautkan akun by-email tanpa memeriksa klaim email terverifikasi** — `backend/app/Http/Controllers/Api/GoogleAuthController.php:52,91-96` *(bukti: kode)* ✅ `1f74353`
  Pencarian pengguna memakai `orWhere('email', $googleUser->email)`, lalu `email_verified_at ??= now()` — tanpa membaca klaim `email_verified` dari Google. Akun Google yang emailnya belum terverifikasi (mungkin di Workspace yang dikelola sendiri) karenanya bisa menaut ke akun SIPERAH yang sudah ada dan langsung masuk.
  **Aksi:** tolak penautan bila klaim `email_verified` bukan `true`; sisa cabang `catch` (`?error=google_auth_failed`) juga masih belum teruji.

- [x] 🟡 **`AU-7` — Status `duplikat` tidak mencatat siapa & kapan** — `backend/app/Http/Controllers/Api/ReportController.php:282-283` *(bukti: kode)* ✅ `d07c09c`
  `validated_by` dan `validated_at` sengaja diisi `null` untuk status selain `divalidasi`/`ditolak`, padahal `duplikat` sama-sama keputusan manusia yang menutup laporan. Laporan terlihat "selesai" tanpa jejak siapa yang memutuskan. Transisi status juga tidak dibatasi — laporan `divalidasi` masih bisa dikembalikan ke `menunggu`.
  **Aksi:** isi kolom resolusi untuk `duplikat` juga, dan batasi transisi yang sah.

- [x] 🟡 **`AU-8` — `water_height_cm` tanpa batas atas** — `backend/app/Http/Requests/StoreReportRequest.php:20` *(bukti: kode)*
  Hanya `integer|min:0`. Nilai seperti 999999 lolos dan ikut masuk agregat dashboard serta dataset peneliti. (Bagian lain temuan ini — `incident_time` boleh masa depan — sudah diperbaiki: `before_or_equal` dengan toleransi 10 menit untuk selisih jam perangkat.)
  **Aksi:** tambahkan `max:1000`.

- [x] 🟡 **`AU-9` — Contoh `risk_probability` di API reference memakai skala 0..1** — `backend/app/Http/Controllers/Api/ResearchController.php:313` *(sudah 82.13 dengan komentar skala)*
  Contohnya menulis `0.82` sedangkan sistem menyimpan persen (0..100). Konsumen eksternal yang menyalin contoh akan salah menafsirkan skalanya seratus kali lipat.
  **Aksi:** perbaiki contohnya ke skala persen.

### 8.3 Performa

- [x] 🟠 **`AU-10` — Export laporan lazy-load `reporter` 1.000× untuk kolom yang tak pernah ditulis** — `backend/app/Http/Controllers/Api/DashboardController.php:256-262` & `:472` *(bukti: kode)* ✅ `06b710a`
  Query-nya `->with('region')` saja, tetapi `reportSummary()` membaca `$report->reporter?->name`. Header CSV-nya (`Kode, Status, Keparahan, Tinggi Air CM, Wilayah, Waktu Kejadian, SLA, Dibuat`) tidak memuat nama pelapor sama sekali — jadi 1.000 query dijalankan untuk nilai yang dibuang. `isReportWithinMonitoringArea()` per baris patut diperiksa dengan cara yang sama.
  **Aksi:** tambahkan `with('reporter')`, atau pakai varian ringkas yang tidak menyentuh relasi itu.

- [x] 🟠 **`AU-11` — Notifikasi risiko tinggi menjalankan 2 query per pengguna, atas seluruh pengguna, setiap hari** — `backend/app/Services/NotificationService.php:142-147` *(bukti: kode)* ✅ `b6f29b7`
  `notifyHighRiskPredictions()` mengambil **semua** user aktif, lalu di dalam loop memanggil `settings()` (`firstOrCreate` = SELECT, kadang + INSERT) dan sebuah `exists()` ke `notification_inbox`. Berbeda dari jalur laporan yang penerimanya hanya admin, jalur ini tumbuh seiring jumlah warga terdaftar — dan dipicu cron harian.
  **Aksi:** pra-muat pengaturan lewat satu `whereIn`, dan ambil penanda "sudah dikirim" sebagai satu query kolektif.

### 8.4 Diagnosa

- [x] 🟠 **`AU-12` — Tiga `catch (\Throwable)` tanpa log di peta publik** — `backend/app/Services/MapService.php:218,399,408` *(pindah ke MapService saat MT-2)*
  Yang di baris 231 mengubah kegagalan jadi `$features = []`: layer garis pantai lenyap dari peta publik tanpa satu pun jejak. Dua sisanya membuat deteksi PostGIS `return false` diam-diam, sehingga sistem turun ke jalur non-spasial tanpa ada yang tahu.
  **Aksi:** `Log::warning()` di ketiganya — tetap fail-safe, tapi kegagalannya meninggalkan jejak.

### 8.5 Testing & refactor yang ditunda

- [x] 🟠 **`AU-13` — Suite Playwright tak pernah jalan di CI** — `.github/workflows/` *(bukti: kode)* ✅ `ccd4d5f`
  15 tes e2e nyata (`login`/`admin`/`map`/`province`/`research`/`report-flow`) hanya berjalan bila seseorang mengetikkannya di mesin lokal. Tak ada satu pun dari lima workflow yang memanggilnya, jadi suite ini bisa membusuk tanpa ketahuan.
  **Aksi:** tambahkan job Playwright — nightly sudah cukup untuk mulai.

- [ ] 🟠 **`AU-14` — Pipeline ML Python tanpa test, dan CI-nya menelan kegagalan** — `.github/workflows/ml-predict.yml:37` *(bukti: kode)*
  `main.py`, `feature_engineering`, `predict_forecast`, `labeler`, dan `PredictionContract` tidak punya pytest sama sekali; yang ada hanya uji wrapper PHP dengan stub. Workflow-nya pun berjalan terjadwal langsung ke DB **produksi**, dan cek konektivitasnya diakhiri `|| echo "GAGAL/TIMEOUT"` sehingga kegagalan tidak pernah menggagalkan job.
  **Aksi:** suite pytest di `ml-api` yang jalan pada PR menyentuh `ml-api/**`, dan buat kegagalan konektivitas benar-benar menggagalkan job.

- [ ] 🟠 **`AU-15` — `CitizenModePage.tsx` 1.053 baris dengan Desktop & Mobile hampir identik** — `frontend/src/features/public-map/CitizenModePage.tsx:244` *(bukti: kode)*
  `CitizenModeDesktop` (~300 baris JSX) dan `CitizenModeMobile` (~290) menduplikasi blok forecast/actionCards/nearby. Setiap perubahan harus ditulis dua kali. Ini halaman publik yang paling banyak dilihat warga dan tidak punya test komponen.
  **Ditunda sengaja** di audit sebelumnya agar kegagalan refactor tidak menyeret perbaikan bug lain saat revert — keputusan itu masih berlaku.
  **Sudah lebih mudah dikerjakan sejak [`KM-4`](#2--kode-mati--sisa-peralihan):** ke-13 props yang dulu `any` kini punya satu tipe bersama `CitizenModeViewProps`, jadi sub-komponen yang diekstrak akan langsung terjaga tsc — yang tersisa murni memindahkan JSX.

- [ ] 🟠 **`AU-16` — Tidak ada `app/Enums`: status, peran, dan kelas risiko sebagai literal string** — `backend/app/Services/ReportAccessService.php:28-32` *(bukti: kode)*
  DB memakai enum Postgres, PHP tidak memetakannya. Ini bukan kerapian belaka — bukti kerugiannya ada di docblock file itu sendiri: saat peran disederhanakan 5→3, cabang `'bpbd_provinsi', 'admin'` tak sengaja berubah jadi `'peneliti', 'admin'`, yang **menaikkan peneliti dari 403 menjadi akses penuh ke laporan berisi identitas pelapor**. Enum akan membuat kekeliruan seperti itu gagal saat kompilasi.
  **Aksi:** buat `ReportStatus`, `UserRole`, `RiskClass` sebagai backed enum, mulai dari titik yang menentukan otorisasi.

- [x] 🟡 **`AU-17` — Satu tes lulus tanpa memverifikasi apa pun** — `backend/tests/Feature/ApiFoundationTest.php:789` *(bukti: kode)*
  `test_audit_service_is_fail_safe_when_storage_rejects_payload()` memanggil `AuditService::write()` dengan outcome tak sah lalu berakhir `$this->assertTrue(true)`. Tes ini tak bisa gagal, jadi ia hanya memberi rasa aman palsu bahwa fail-safe audit sudah teruji.
  **Aksi:** `assertDatabaseMissing` pada baris audit yang tak sah, dan pastikan tak ada exception yang lolos.

- [ ] 🟡 **`AU-18` — Tiga tes bergantung pada state global DB/cache, bukan state miliknya sendiri** — `backend/tests/Feature/QueueWorkerTest.php:52`, `AuthFlowTest.php:16-18`, `PublicMapTest.php:21-23` *(bukti: kode)*
  `QueueWorkerTest` meng-assert `failed_jobs` **global** bernilai 0 — satu baris sisa run lain menggagalkannya. `AuthFlowTest` menjaga jumlah panggilan `/auth/register` maksimal 4 agar tak menabrak limiter 5/jam. `PublicMapTest` memakai nama kabupaten unik + `Cache::flush()` karena cache array bertahan antar tes. Ketiganya sudah didokumentasikan di komentar, jadi ini kerapuhan yang dikelola, bukan yang tersembunyi — tetapi tetap gagal karena sebab yang tak ada hubungannya dengan yang diuji.
  **Aksi:** assert delta alih-alih nilai absolut, dan `RateLimiter::clear()` + flush cache terpusat di base `TestCase`.

### 8.6 Yang digugurkan dan alasannya

Lima item terbuka **tidak** dipindahkan. Dua di antaranya sudah tidak berlaku karena kodenya berubah setelah audit ditulis, dua duplikat item yang sudah ada di dokumen ini, satu keputusan sadar untuk tidak dikerjakan.

| Item audit lama | Alasan gugur |
|---|---|
| API key BPBD Provinsi selalu ditolak 403 (ditandai 🔴) | **Tidak berlaku lagi.** Peran `bpbd_provinsi` hilang saat peran disederhanakan 5→3, jadi whitelist `['peneliti','admin']` di `AuthenticateApiKey.php:37` kini persis sama dengan daftar peran yang boleh membuat key. Ketimpangan yang jadi pokok temuan sudah tertutup dengan sendirinya. |
| SLA overdue fail-open untuk operator tanpa `region_id` | **Tidak berlaku lagi.** `notifyReportSlaOverdue()` dan `notifyNewReportForReview()` kini sama-sama memilih seluruh admin aktif; cabang berbasis `region_id` yang jadi pokok temuan sudah tidak ada. |
| `DashboardController` kegemukan & `normalizeRegency` terduplikasi | Duplikat [`MT-2`](#5--perawatan--struktur) dan [`MT-3`](#5--perawatan--struktur). |
| Sapuan `any` di frontend | Duplikat [`KM-4`](#2--kode-mati--sisa-peralihan), yang sudah melacak angkanya (59). |
| Amplop respons API tak konsisten antar endpoint | **Diputuskan tidak dikerjakan.** Nyata, tapi konsumennya hanya frontend sendiri; `/api/v1/*` yang menghadap luar sudah punya kontrak terpisah di `docs/operations/api-contract.md`. Biaya penyeragaman lebih besar dari manfaatnya sekarang. |

Satu temuan dipindahkan **sebagian**: "`incident_time` boleh masa depan, `water_height_cm` tanpa batas atas" — paruh pertamanya sudah diperbaiki (`before_or_equal` + toleransi 10 menit), paruh keduanya dilanjutkan sebagai `AU-8`.

---

**Urutan pengerjaan yang disarankan:** dahulukan `AU-1` dan `AU-2`. Keduanya menghasilkan angka risiko yang salah di layar warga, dan itu adalah keluaran utama sistem ini — dampaknya lebih besar daripada mayoritas item lain di dokumen ini.
