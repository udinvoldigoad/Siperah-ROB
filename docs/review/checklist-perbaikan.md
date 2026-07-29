# 🔧 Checklist Perbaikan Lanjutan — SIPERAH-RoB

> **Dibuat:** 2026-07-29 · **20 temuan** · Semua rujukan `file:baris` sudah dibuka & diverifikasi.
> **Cakupan:** kode mati, bug, logika bisnis, UI tak konsisten, perawatan, data.
> **Bukan pengganti** [`audit-perbaikan.md`](audit-perbaikan.md) — dokumen itu masih menyimpan **26 item terbuka** dan tidak diulang di sini. Lihat [§8](#8-hubungan-dengan-audit-sebelumnya).

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
| 1 | [Produksi — butuh keputusan](#1--produksi--butuh-keputusan) | 1 | 0 | 1 | 2 | **2 ✅** |
| 2 | [Kode mati & sisa peralihan](#2--kode-mati--sisa-peralihan) | 0 | 1 | 3 | 4 | 0 |
| 3 | [Logika bisnis](#3--logika-bisnis) | 0 | 4 | 1 | 5 | 0 |
| 4 | [UI tidak konsisten](#4--ui-tidak-konsisten) | 0 | 1 | 1 | 2 | 0 |
| 5 | [Perawatan & struktur](#5--perawatan--struktur) | 0 | 3 | 0 | 3 | 0 |
| 6 | [Test & tooling](#6--test--tooling) | 0 | 1 | 0 | 1 | 0 |
| 7 | [Data & skema](#7--data--skema) | 0 | 1 | 2 | 3 | 0 |
| | **Total** | **1** | **11** | **8** | **20** | **2** |

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

- [ ] 🟠 **`KM-1` — `phone_number` divalidasi & ditampilkan, tapi tak ada satu pun form yang mengisinya** — `backend/app/Http/Requests/RegisterRequest.php:34`, `backend/app/Http/Resources/UserResource.php:16` *(bukti: kode)*
  Kolom ini punya aturan validasi, kolom DB, dan muncul di respons API — tetapi pencarian `phone_number` di seluruh `frontend/src` menghasilkan **0 kemunculan**. Sempat diwajibkan untuk pendaftaran peneliti lalu dicabut atas permintaan.
  **Aksi:** pilih satu — kembalikan sebagai isian opsional di profil, atau buang dari request & resource (kolom DB boleh tinggal).

- [ ] 🟡 **`KM-2` — Akun seed `operator@` & `provinsi@` menyandang nama peran yang sudah dihapus** — `frontend/e2e/helpers.ts:11-12` *(bukti: kode)*
  Keduanya kini berperan `admin`. Dipertahankan **sengaja** sebagai admin tambahan agar limiter login (10/menit per email+IP) tidak tertabrak antar-spec, dan alasannya sudah dicatat di komentar. Tapi namanya tetap menyesatkan pembaca baru.
  **Aksi:** ganti nama jadi `admin2@`/`admin3@`, atau biarkan dan cukup pertegas komentarnya.

- [ ] 🟡 **`KM-3` — Header progres `audit-perbaikan.md` basi & seluruhnya dikomentari HTML** — `docs/review/audit-perbaikan.md:1-29` *(bukti: kode)*
  Blok progres berhenti di butir 11 dan masih menulis *"Suite backend: 160/160 hijau"* — kini **189/189**. Seluruh blok dibungkus `<!-- -->` sehingga tak terlihat saat dirender, jadi pembaca tak tahu dokumen itu sudah dikerjakan sejauh mana.
  **Aksi:** perbarui angkanya lalu buka komentarnya, atau hapus blok itu dan tunjuk ke dokumen ini.

- [ ] 🟡 **`KM-4` — 59 pemakaian `any` di frontend** — `frontend/src` *(bukti: kode)*
  Naik dari 54 saat audit sebelumnya. Sudah tercatat di audit lama sebagai ditunda; dicatat ulang di sini hanya sebagai penanda tren agar tidak diam-diam bertambah terus.
  **Aksi:** tetapkan batas atas dan turunkan bertahap, mulai dari `catch (err: any)` yang paling gampang diketikkan ulang.

---

## 3. 🧠 Logika bisnis

- [ ] 🟠 **`LB-1` — Kolom `institution` menanggung dua makna berbeda** — `backend/app/Http/Requests/RegisterRequest.php:33` *(bukti: kode)*
  Untuk **warga** isinya "Desa / Wilayah" (opsional); untuk **peneliti** isinya "Instansi / Universitas" (wajib). Kolom yang sama, label berbeda tergantung peran — dan pencarian admin (`AdminController::users`) menyapu kolom ini tanpa membedakan keduanya, sehingga mencari nama kampus juga bisa mengembalikan warga yang kebetulan tinggal di desa bernama mirip.
  **Aksi:** pisahkan jadi dua kolom, atau sempitkan `institution` khusus lembaga dan pindahkan desa warga ke `region_id`.

- [ ] 🟠 **`LB-2` — Dua konsep "tujuan" hidup berdampingan tanpa saling tahu** — `backend/app/Models/User.php:38`, `backend/app/Models/ApiAccessRequest.php:18` *(bukti: kode)*
  `users.research_purpose` (alasan permohonan **akun** peneliti) dan `api_access_requests.purpose` (alasan permohonan **kunci API**) adalah dua kolom terpisah yang menjawab pertanyaan serupa. Admin meninjau keduanya di layar berbeda tanpa rujukan silang, jadi tidak terlihat kalau alasannya bertentangan.
  **Aksi:** tampilkan `research_purpose` di modal tinjau izin API sebagai konteks, atau satukan jadi satu riwayat permohonan per pengguna.

- [ ] 🟠 **`LB-3` — Dashboard operator mencampur dua cakupan dalam satu layar** — `backend/app/Http/Controllers/Api/DashboardController.php:112,116` *(bukti: kode)*
  KPI `pending_reports` dihitung **se-provinsi**, sementara `region_statuses` di layar yang sama tetap **per wilayah**. Pembaca wajar menyimpulkan keduanya berasal dari cakupan yang sama, padahal tidak — angka KPI bisa jauh lebih besar dari jumlah baris di bawahnya.
  **Aksi:** samakan cakupannya, atau beri label eksplisit ("se-provinsi" vs "wilayah Anda") pada masing-masing.

- [ ] 🟠 **`LB-4` — `GroundTruthReport` tanpa SoftDeletes, padahal `User` memakainya** — `backend/app/Models/GroundTruthReport.php:9` vs `backend/app/Models/User.php:14` *(bukti: kode)*
  Laporan terhapus **permanen**. Akun bisa dipulihkan, laporannya tidak — padahal laporan adalah bukti lapangan yang menopang validasi dan jejak audit. Ini juga akar 45 job antrean gagal di produksi (sudah diredam di `8d9e225` dengan berhenti membawa model ke antrean, tapi penghapusannya sendiri tetap permanen).
  **Aksi:** tambahkan SoftDeletes + kolom `deleted_at`, atau putuskan secara sadar bahwa penghapusan laporan memang final dan catat alasannya.

- [ ] 🟡 **`LB-5` — `permission_workflow.status` menduplikasi `status` di level atas** — `backend/app/Http/Resources/UserResource.php:19,32` *(bukti: kode)*
  Nilai yang sama dikirim dua kali dalam satu objek. Tidak berbahaya, tapi dua sumber untuk satu fakta selalu berisiko berbeda saat salah satunya diubah.
  **Aksi:** buang yang di dalam `permission_workflow`.

---

## 4. 🎨 UI tidak konsisten

- [ ] 🟠 **`UI-1` — Menu titik tiga baru ada di tabel admin saja** — `frontend/src/features/admin/AdminUsersPage.tsx` *(bukti: kode)*
  Tabel pengguna kini memakai satu tombol titik tiga, sementara tabel di dashboard operator dan pantauan provinsi masih memajang tombol berjajar. Pola aksi baris jadi berbeda antar halaman dalam aplikasi yang sama.
  **Aksi:** angkat `RowActionsMenu` ke `shared/components` lalu pakai di tabel lain — komponennya sudah mandiri dan siap dipindah.

- [ ] 🟡 **`UI-2` — Ratusan warna heksadesimal hardcoded di luar token CSS** — `frontend/src/app/PortalPage.tsx` (82), `features/research/ResearchPortalPage.tsx` (39), `features/public-map/OnboardingPage.tsx` (31) *(bukti: kode)*
  Warna yang ditulis langsung tidak ikut berubah saat tema gelap aktif. Audit sebelumnya sudah menemukan token yang hilang menyebabkan dark mode mati; ini sumber masalah yang sejenis dan belum tersentuh.
  **Aksi:** pindahkan ke variabel di `shared/styles/tokens.css`, dahulukan `PortalPage` karena itu halaman pertama yang dilihat tamu.

---

## 5. 🏗️ Perawatan & struktur

- [ ] 🟠 **`MT-1` — `AdminUsersPage.tsx` 1.514 baris** — `frontend/src/features/admin/AdminUsersPage.tsx` *(bukti: kode)*
  File terbesar di frontend. Memuat 4 modal (tambah pengguna, tinjau izin API, kelola pengguna, tinjau permohonan peneliti), 2 komponen dropdown, tabel, filter, paginasi, dan seluruh CSS-nya dalam satu berkas.
  **Aksi:** pisahkan tiap modal ke berkasnya sendiri; `RowActionsMenu` & `RegionCombobox` layak naik ke `shared/components`.

- [ ] 🟠 **`MT-2` — Controller gemuk: `PublicMapController` 730 baris, `ResearchController` 693** — `backend/app/Http/Controllers/Api/` *(bukti: kode)*
  Keduanya melebihi `DashboardController` (507) yang sudah ditandai kegemukan di audit sebelumnya.
  **Aksi:** tarik logika kueri ke service, samakan polanya dengan `ReportAccessService`.

- [ ] 🟠 **`MT-3` — Dua normalisasi nama wilayah yang berdiri sendiri-sendiri** — `backend/app/Http/Controllers/Api/DashboardController.php:503` & `backend/app/Services/NotificationService.php` (`matchesMonitoredRegions`) *(bukti: kode)*
  Keduanya sama-sama membuang prefiks "Kabupaten/Kota" agar "Bandar Lampung" cocok dengan "Kota Bandar Lampung", tapi ditulis terpisah. Kalau satu diperbaiki dan yang lain tidak, notifikasi dan dashboard akan diam-diam menyaring wilayah secara berbeda — kegagalan yang tak menimbulkan error, hanya data yang hilang.
  **Aksi:** satukan jadi satu helper (mis. `App\Support\RegionName`) dan pakai di kedua tempat.

---

## 6. 🧪 Test & tooling

- [ ] 🟠 **`TS-1` — Tak ada cara cepat menguji pengiriman email** — `backend/app/Console/Commands/SendTestNotification.php` *(bukti: kode)*
  `php artisan notify:test <email>` hanya mengirim `TestPushNotification` yang kanalnya push saja. Saat memperbaiki kanal email, tidak ada perintah untuk membuktikan SMTP produksi benar-benar jalan tanpa memicu kejadian sungguhan.
  **Aksi:** tambahkan opsi `--mail` yang mengirim notifikasi uji lewat kanal mail.

---

## 7. 🗄️ Data & skema

- [ ] 🟠 **`DT-1` — Baris `notification_settings` yatim tak pernah dibersihkan** — *(bukti: produksi)*
  Di produksi ada **7 baris pengaturan untuk 4 akun aktif** — 3 sisanya milik akun yang sudah dihapus. Tidak ada cascade maupun pembersihan.
  **Aksi:** tambahkan `on delete cascade` pada FK `user_id`, atau bersihkan saat akun dihapus permanen.

- [ ] 🟡 **`DT-2` — Batas panjang `research_purpose` hanya ada di request** — `backend/database/migrations/2026_07_29_000001_add_research_purpose_to_users.php` *(bukti: kode)*
  Kolomnya `text` tanpa batas; `max:1000` hanya dijaga `RegisterRequest`. Jalur lain yang menulis kolom ini di kemudian hari tidak akan terjaga.
  **Aksi:** cukup disadari — atau tambahkan constraint bila kolom ini nanti bisa ditulis dari lebih dari satu tempat.

- [ ] 🟡 **`DT-3` — `catch {}` menelan galat parse JSON di klien API** — `frontend/src/shared/api/client.ts:57` *(bukti: kode)*
  Kalau respons galat bukan JSON (mis. halaman error HTML dari server), badannya dibuang diam-diam dan pengguna hanya melihat pesan generik. Sengaja fail-safe, tapi menyulitkan diagnosa persis saat paling dibutuhkan.
  **Aksi:** tetap jangan melempar, tapi `console.debug` badan mentahnya saat `import.meta.env.DEV`.

---

## 8. Hubungan dengan audit sebelumnya

[`audit-perbaikan.md`](audit-perbaikan.md) masih menyimpan **26 item terbuka** yang **tidak diulang** di sini, antara lain:

| Kelompok | Contoh item terbuka |
|---|---|
| Backend performa | N+1 `reporter` di `operatorReportsExport`, N+1 loop notifikasi |
| Backend korektness | penguncian aksi validasi laporan, `duplikat` tak catat validator |
| Pipeline ML | elevasi/jarak-pantai NULL → risiko maksimum, `confidence_score` tak konsisten |
| Testing | pipeline ML tanpa test, e2e Playwright tak jalan di CI |
| Refactor (ditunda sengaja) | dedup CitizenMode Desktop/Mobile, sapuan `any` |

**Urutan pengerjaan yang disarankan:** selesaikan dulu 🔴 dan 🟠 di audit lama yang menyangkut korektness ML & penguncian laporan — dampaknya ke integritas data lebih besar daripada mayoritas item di dokumen ini.
