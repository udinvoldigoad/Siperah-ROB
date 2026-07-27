# 🔧 Checklist Perbaikan Teknis — SIPERAH-RoB

> **Audit:** 2026-07-26 · **69 temuan terverifikasi** (UI/UX · Frontend · Backend · Logika Bisnis · Keamanan · Testing)
> **Metode:** audit multi-agent (6 reviewer per dimensi), tiap temuan **diverifikasi grounded ke kode aslinya** (dibaca file-nya, dikutip `file:line`). Temuan `REJECTED` sudah dibuang; yang tersisa `CONFIRMED` kecuali ditandai ⚠️ `PLAUSIBLE` (perlu konfirmasi manual).
> **Legenda severity:** 🔴 tinggi · 🟠 sedang · 🟡 rendah
> Catatan: dokumen ini dihasilkan otomatis lalu diverifikasi; tetap sanity-check tiap item sebelum dieksekusi.
>
> **Progres (2026-07-26):**
> 1. ✅ Cluster keamanan **OTP reset kata sandi** (`b1908f9`) — throttle, `Hash::check` timing-safe, stop plaintext/log, lockout 5×, cabut token Sanctum, respons anti-enumeration, From email default, + 6 test baru.
> 2. ✅ **`env()` runtime → `config/limits.php`** (`2350fc1`) — rate-limit & retensi kini benar-benar terbaca saat `config:cache`; terverifikasi di produksi.
> 3. ✅ **roleMap dashboard** (`db643e7`, rekan tim) — operator/provinsi tak lagi terlempar ke login.
> 4. ✅ **API key BPBD Provinsi + `generated_at` Mode Awam** (`654b183`) — whitelist middleware diselaraskan; `generated_at` terisi (terverifikasi live).
>
> 5. ✅ **Index DB** (`1d7b36e`) — 4 index komposit (FK & kolom filter) via migrasi idempoten + `schema.sql`.
>
> 6. ✅ **Privasi koordinat pelapor** (`efa3118`) — pembulatan 3 desimal fail-safe di seluruh jalur publik.
>
> **Sisa prioritas 🔴:** timezone UTC/WIB · pagination `provinceForecast`.
> Suite backend: **135/135 hijau**.

---

## 1. Ringkasan Eksekutif

Sistem **fungsional & terstruktur**, tetapi menyimpan beberapa cacat serius di lapisan **keamanan auth**, **konsistensi konfigurasi produksi**, dan **korektness lintas-zona-waktu** yang bisa berdampak nyata ke pengguna & integritas data. Pola paling merusak yang berulang:

- `env()` dibaca **saat runtime** → rusak/diam-diam pakai default setelah `config:cache` di produksi.
- Token/warna CSS tak terdefinisi (`--brand`, `--brand-soft`, `--success`) → dark mode & highlight mati.
- Alur **OTP reset kata sandi** lemah: plaintext, di-log, tanpa throttle, tanpa cabut sesi.

Kualitas frontend menengah (banyak `any`, duplikasi boilerplate, fetch tanpa guard anti-race). Cakupan uji rapuh: alur paling kritis (OTP, Google OAuth, pipeline ML) **sama sekali tak teruji**, dan suite e2e Playwright **tak pernah jalan di CI**. Mayoritas temuan **terlokalisasi & actionable** — bisa dicicil cepat tanpa refaktor besar.

---

## 2. 🎯 TOP Prioritas (kerjakan dulu)

- [x] ✅ 🔴 **OTP reset-password tanpa throttle + plaintext + banding non-timing-safe → account takeover** — SELESAI (`b1908f9`) — `backend/routes/api.php:22`, `backend/app/Http/Controllers/Api/PasswordResetController.php`
- [x] ✅ 🔴 **`env()` dibaca saat runtime → rate-limit & config diam-diam pakai default setelah `config:cache`** — SELESAI (`2350fc1`): `config/limits.php` baru; provider/ResearchController/PruneAuditLogs baca via `config('limits.*')`. Terverifikasi di produksi dengan config ter-cache (180/20/120/365). **Nol `env()` runtime** tersisa di `app/`,`routes/`,`bootstrap/`,`database/`.
- [x] ✅ 🔴 **Tombol Dashboard salah rute → operator & BPBD provinsi terlempar ke `#/login`** — SELESAI (`db643e7`, oleh rekan tim): kini pakai `dashboardHashForRole()`.
- [x] ✅ 🔴 **Tak ada index pada `ground_truth_reports.status`, FK `region_id`, `audit_logs.actor_user_id`** — SELESAI (`1d7b36e`): 4 index komposit sesuai pola query nyata, via migrasi idempoten + `schema.sql`.
- [ ] 🔴 **Off-by-one hari: peta/dashboard/Mode Awam anchor UTC-`today()` tapi notif high-risk pakai WIB** — `backend/app/Http/Controllers/Api/PublicMapController.php:65,550`
- [x] ✅ 🔴 **API key buatan BPBD Provinsi ditolak middleware 403 (mati sejak lahir)** — SELESAI (`654b183`): whitelist diselaraskan + test regresi.
- [x] ✅ 🔴 **Koordinat presisi penuh pelapor bocor di endpoint publik** — SELESAI (`efa3118`): pembulatan 3 desimal fail-safe (default aman) di `/public/map` & `/public/mode-awam`; pihak berwenang tetap presisi. 3 test mengunci dua arah.
- [ ] 🔴 **`provinceForecast` kembalikan seluruh prediksi 30 hari tanpa pagination di endpoint publik** — `backend/app/Http/Controllers/Api/PublicMapController.php:562`

## 3. ⚡ Quick Wins (kecil, berdampak besar)

- [ ] **Fix `roleMap` → pakai `dashboardHashForRole(user.role)`** — `frontend/src/app/PortalPage.tsx:60`
- [ ] **Ganti `var(--brand)`/`--brand-soft`/`--success` → `var(--accent)`/`--accent-soft`/`--low`** — `NotificationSettingsPage.tsx:211`, `ReportHistoryPage.tsx:129`, `tokens.css`
- [x] ✅ **Hapus `Log::info` OTP plaintext + pasang `throttle:6,1` di route reset-password** — SELESAI (`b1908f9`)
- [x] ✅ **Fix `roleMap` → `dashboardHashForRole()`** — SELESAI (`db643e7`, rekan tim)
- [x] ✅ **`$prediction?->created_at` → `->generated_at`** — SELESAI (`654b183`), terverifikasi live (bukan `null` lagi)
- [ ] **`$prediction?->created_at` → `->generated_at`** (Mode Awam `generated_at` selalu `null`) — `PublicMapController.php:532`
- [ ] **`setWaterHeight("")` (bukan `"45"`) setelah submit** — `ReportWizardPage.tsx:217`
- [ ] **`.btn:disabled { cursor: not-allowed }`** (sisakan `wait` khusus loading) — `tokens.css:211`

---

## 4. 🎨 UI/UX & Desain (14)

- [ ] 🔴 **AppShell mengabaikan prop `breadcrumbs` & `subtitle`** — `frontend/src/shared/components/AppShell.tsx:34`
  Mengimpor `Breadcrumbs` & mendestruktur `subtitle`/`breadcrumbs` tapi tak pernah dirender; topbar hanya breadcrumb hardcoded. Banyak halaman (ReportWizard, NotificationSettings, dll) kirim prop yang hilang diam-diam. → Render `<Breadcrumbs items={breadcrumbs}/>` + `subtitle`, atau hapus prop.
- [ ] 🔴 **Tombol Dashboard di landing salah rute utk operator/provinsi** — `frontend/src/app/PortalPage.tsx:60`
  `roleMap` pakai kunci `operator_kabkota`/`operator_provinsi` yang tak ada (peran nyata `bpbd_operator`/`bpbd_provinsi`) → `undefined` → jatuh ke `#/login`. → Pakai `dashboardHashForRole()`.
- [ ] 🔴 **Chip Wilayah Pantau tak terbaca (dark mode): `--brand` hitam, `--brand-soft` tak ada** — `frontend/src/features/notifications/NotificationSettingsPage.tsx:211`
  `.ns-chip` pakai `--brand-soft` (undefined) & `--brand: #000000` tanpa override dark. → Pakai `--accent`/`--accent-soft`.
- [ ] 🟠 **Variabel CSS `--success` tak terdefinisi → highlight hijau hilang** — `frontend/src/features/reports/ReportHistoryPage.tsx:129`
  Dipakai di ReportHistory & NotificationSettings; `--success` tak ada di tokens.css. → Ganti `var(--low)` (emerald sudah ada).
- [ ] 🟠 **Kursor `wait` (jam pasir) pada SEMUA tombol disabled** — `frontend/src/shared/styles/tokens.css:211`
  Tombol disabled karena validasi tampak seolah loading. → `cursor: not-allowed`, `wait` hanya utk `[data-loading]`.
- [ ] 🟠 **KPI 'Menunggu Approval' admin tak pernah ter-highlight (`.metric-card.warning` tak ada)** — `frontend/src/features/admin/AdminUsersPage.tsx:607`
  → Ganti kelas ke `medium` (amber) atau tambahkan aturan `.metric-card.warning`.
- [ ] 🟠 **Mode Awam minta izin GPS otomatis saat halaman dibuka** — `frontend/src/features/public-map/CitizenModePage.tsx:922`
  `useEffect(requestGpsLocation, [])` prompt izin tanpa gestur; ditolak → banner error langsung. → Tunda GPS sampai user klik tombol.
- [ ] 🟠 **State loading tidak konsisten: teks polos vs skeleton** — `frontend/src/features/dashboards/OperatorDashboardPage.tsx:345`
  Operator/PublicMap pakai teks; Admin/History pakai `LoadingBlock`. → Seragamkan skeleton utk daftar/tabel.
- [ ] 🟠 **Badge risiko di peta tak bisa diaktifkan lewat keyboard** — `frontend/src/features/public-map/PublicMapPage.tsx:313`
  `role=button` + `tabindex=0` tapi hanya listener click, tanpa keydown Enter/Space. → Tambah keydown atau pakai `<button>`.
- [ ] 🟠 **Checkbox 'Ingat saya' di login tidak berfungsi** — `frontend/src/features/auth/LoginPage.tsx:269`
  Tanpa `checked`/`onChange`; token selalu ke localStorage. → Hubungkan ke logika nyata atau hapus.
- [ ] 🟠 **Toast error hilang otomatis 4 detik tanpa pause-on-hover** — `frontend/src/shared/components/Toast.tsx:42`
  Pesan error panjang bisa lenyap sebelum terbaca. → Perpanjang/no-auto-dismiss utk error + pause saat hover.
- [ ] 🟡 **Overlay loading peta pakai putih hardcoded (silau di dark mode)** — `frontend/src/features/public-map/PublicMapPage.tsx:1134`
  `rgba(255,255,255,.6)`. → Pakai token surface / override tema.
- [ ] 🟡 **Badge status pengguna menampilkan teks mentah huruf kecil** — `frontend/src/features/admin/AdminUsersPage.tsx:1040`
  `{user.status}` mentah ('aktif'/'menunggu') vs label berkapitalisasi di tempat lain. → Buat peta label status.
- [ ] 🟡 **Form laporan mengisi ulang tinggi air ke '45' setelah submit** — `frontend/src/features/reports/ReportWizardPage.tsx:217`
  `setWaterHeight("45")` → laporan berikutnya auto-severity 'Parah'. → Reset ke `""`.

## 5. ⚛️ Frontend (React/TS) (13)

- [ ] 🔴 **ProvinceDashboardPage fetch tanpa guard `active`/AbortController → data bisa tertukar** — `frontend/src/features/dashboards/ProvinceDashboardPage.tsx:124`
  Respons request lama bisa menimpa yang baru saat ganti bulan/kabupaten. → Pola `let active=true; ... return ()=>{active=false}`.
- [ ] 🔴 **Polling 30 detik OperatorDashboard memaksa balik ke halaman 1** — `frontend/src/features/dashboards/OperatorDashboardPage.tsx:99`
  `setInterval(loadReports(1))` menyentak operator dari halaman 2/3. → Refresh halaman aktif + guard anti-race.
- [ ] 🟠 **App.tsx efek samping (redirect + baca localStorage) saat render** — `frontend/src/app/App.tsx:44`
  `renderRoute()` mutasi `window.location.hash` saat render → memicu re-render. → Pindahkan guard ke `useEffect`.
- [ ] 🟠 **CitizenMode Desktop & Mobile hampir identik, props `: any`** — `frontend/src/features/public-map/CitizenModePage.tsx:244`
  Duplikasi JSX (forecast/actionCards/nearby) harus diedit dua kali. → Ekstrak sub-komponen + tipe props.
- [ ] 🟠 **Penggunaan `any` tersebar luas (Variants, catch, `api<any>`, GeoJSON)** — `frontend/src/features/admin/AuditLogPage.tsx:52`
  Melumpuhkan type-check padahal tipe konkret sudah ada. → `Variants`, tipe respons konkret, `catch(err: unknown)`.
- [ ] 🟠 **Pencarian pengguna admin memicu request tiap ketikan (tanpa debounce)** — `frontend/src/features/admin/AdminUsersPage.tsx:982`
  → Debounce 300–400ms sebelum trigger fetch.
- [ ] 🟠 **Boilerplate export CSV terduplikasi di 5 file, URL tidak konsisten, bypass `api()`** — `frontend/src/features/dashboards/OperatorDashboardPage.tsx:137`
  `${apiBase}/...` vs `apiUrl('/api/...')` → path divergen; semua bypass handler 401 terpusat. → Helper `downloadFile()` tunggal.
- [ ] 🟠 **`picsum.photos` placeholder + CSS mati `.inline-pill-img` + properti `align-middle` invalid** — `frontend/src/app/PortalPage.tsx:267`
  → Hapus blok mati & URL eksternal acak.
- [ ] 🟡 **Data laporan dummy hardcoded ikut ke produksi via `findOperatorReport`** — `frontend/src/features/reports/reportData.ts:74`
  3 laporan contoh nyeed ReportDetailPage; bisa tampil saat fetch gagal. → Hapus mock, awali `undefined` + skeleton.
- [ ] 🟡 **Komponen `MetricCard` tidak pernah diimpor (file mati)** — `frontend/src/shared/components/MetricCard.tsx:3`
  → Hapus atau pakai ulang menggantikan kartu inline.
- [ ] 🟡 **Parsing user dari localStorage diduplikasi di 8 file tanpa helper terpusat** — `frontend/src/shared/components/AppShell.tsx:98`
  → Sediakan `getCurrentUser()`/`getToken()`/`isLoggedIn()` (atau AuthContext).
- [ ] 🟡 **Reverse-geocode ke Nominatim tanpa AbortController / handling rate-limit** — `frontend/src/features/public-map/CitizenModePage.tsx:857`
  fetch mentah tanpa timeout/429. → Bungkus AbortController + timeout, pertimbangkan via backend.
- [ ] 🟡 ⚠️ **Google Fonts (Inter) dari CDN berpotensi diblok CSP produksi** — `frontend/src/app/PortalPage.tsx:73` *(PLAUSIBLE — belum ada file CSP di repo yang membuktikan)*
  Glyph peta sengaja di-host sendiri karena font eksternal diblok CSP. → Self-host Inter atau allowlist CSP.

## 6. 🛠️ Backend (Laravel) (13)

- [x] ✅ 🔴 **`env()` dipakai saat runtime → nilai `.env` diabaikan setelah `config:cache`** — SELESAI (`2350fc1`): semua pindah ke `config/limits.php`.
- [x] ✅ 🔴 **Tak ada index pada `ground_truth_reports.status`, FK `region_id`, `audit_logs.actor_user_id`** — SELESAI (`1d7b36e`):
  `reports_user_created_idx (user_id,created_at)` · `reports_status_created_idx (status,created_at)` · `reports_region_idx (region_id)` · `audit_logs_actor_idx (actor_user_id,created_at)`.
- [ ] 🔴 **N+1 count query per dataset di `ResearchController::stats` & `datasets`** — `backend/app/Http/Controllers/Api/ResearchController.php:268`
  1 COUNT (predictions/reports/tidal) per dataset tiap buka halaman statistik. → Hitung agregat sekali + cache.
- [ ] 🔴 **`provinceForecast` kembalikan seluruh prediksi 30 hari tanpa pagination** — `backend/app/Http/Controllers/Api/PublicMapController.php:562`
  Endpoint publik menarik semua wilayah × 30 hari. → Agregasi per tanggal / pagination / wajibkan filter regency.
- [ ] 🟠 **`reporter` tak di-eager-load pada `operatorReportsExport` (N+1 s/d 1000 baris)** — `backend/app/Http/Controllers/Api/DashboardController.php:244`
  `reporter?->name` lazy-load per baris padahal tak ditulis ke CSV. → Tambah `with('reporter')` atau varian summary.
- [ ] 🟠 **N+1 loop notifikasi (settings & regency per user) di NotificationService** — `backend/app/Services/NotificationService.php:172`
  `settings()` firstOrCreate per user + query regency per operator dalam loop. → Pra-muat `whereIn` + peta region→regency.
- [ ] 🟠 **Status/peran/kelas risiko tersebar sebagai literal string (tanpa enum)** — `backend/app/Services/ReportAccessService.php:27`
  Tak ada `app/Enums`; DB pakai Postgres enum tapi tak dipetakan ke PHP. → Buat enum `ReportStatus`/`UserRole`/`RiskClass`.
- [ ] 🟠 **Exception ditelan diam-diam tanpa logging di PublicMapController** — `backend/app/Http/Controllers/Api/PublicMapController.php:223`
  `catch(\Throwable){ $features=[]; }` → layer garis pantai kosong tanpa jejak; `hasPostgis()` fallback diam. → `Log::warning()` di catch.
- [x] ✅ 🟠 **Alamat pengirim email OTP hardcode ke `onboarding@resend.dev`** — SELESAI (`b1908f9`): hapus `->from()`, pakai `config('mail.from')` (selaras SPF/DKIM Gmail SMTP).
- [ ] 🟠 **Celah validasi: `incident_time` boleh masa depan, `water_height_cm` tanpa batas atas** — `backend/app/Http/Requests/StoreReportRequest.php:22`
  Register password hanya `min:8`. → `before_or_equal:now`, `max:1000`, konfirmasi/kompleksitas password.
- [ ] 🟠 **DashboardController kegemukan & logika `normalizeRegency` terduplikasi** — `backend/app/Http/Controllers/Api/DashboardController.php:29`
  ~478 baris query mentah; `normalizeRegency` ganda dg ReportAccessService; `ReportController::store` menampung banyak hal. → Ekstrak ke service.
- [ ] 🟡 **Bentuk amplop response API tak konsisten antar endpoint** — `backend/app/Http/Controllers/Api/AdminController.php:114`
  `{message,id}` vs `{message,data}` vs `{access_token,...}` vs JsonResource `{data,meta}`. → Konvensi amplop tunggal.
- [x] ✅ 🟠 **OTP disimpan plaintext + tanpa batas percobaan + route reset tanpa throttle** — SELESAI (`b1908f9`, lihat §7 cluster OTP).

## 7. 🔐 Keamanan & Integritas Data (9)

- [x] ✅ 🔴 **Endpoint verifikasi OTP reset-password tanpa rate limit → brute force** — SELESAI (`b1908f9`): `throttle:6,1` + counter lockout 5× + `Hash::check` timing-safe.
- [x] ✅ 🟠 **Forgot-password membocorkan keberadaan email (user enumeration)** — SELESAI (`b1908f9`): respons seragam di sendOtp & resetWithOtp (terverifikasi live).
- [x] ✅ 🟠 **OTP disimpan plaintext di DB & ditulis ke log aplikasi** — SELESAI (`b1908f9`): kolom `otp` diisi `null`, `Log::info` OTP dihapus, verifikasi via hash `token`.
- [x] ✅ 🟠 **Reset kata sandi tidak mencabut token/sesi Sanctum** — SELESAI (`b1908f9`): `$user->tokens()->delete()` setelah reset.
- [ ] 🟠 **Token Sanctum dikirim lewat query string URL pada callback Google OAuth** — `backend/app/Http/Controllers/Api/GoogleAuthController.php:54`
  `?token=...` bocor ke history/log/Referer. → Kode satu-kali via POST, atau cookie HttpOnly, atau fragment `#`.
- [ ] 🟠 **Callback Google OAuth abaikan status akun (signup auto-aktif, lewati approval)** — `backend/app/Http/Controllers/Api/GoogleAuthController.php:28`
  Beda dg login email/password yang blokir status ≠ aktif. → Terapkan cek status + samakan kebijakan approval.
- [x] ✅ 🟠 **Koordinat presisi penuh pelapor bocor di endpoint publik** — SELESAI (`efa3118`): `ReportResource` membulatkan 3 desimal secara **default**, presisi penuh hanya bila `$request->user()` ada → endpoint publik baru otomatis aman. Titik `/public/map` ikut dibulatkan. Dokumen kontrak API diperbarui.
- [ ] 🟡 **Kolom `role`/`status`/`google_id` ada di `$fillable` User (risiko laten mass assignment)** — `backend/app/Models/User.php:21`
  Belum ada exploit aktif, tapi satu endpoint lalai = eskalasi hak. → Keluarkan dari `$fillable`, set eksplisit.
- [ ] 🟡 ⚠️ **`APP_DEBUG=true` default di `.env.example` (+ baris CORS malformed)** — `backend/.env.example:4` *(PLAUSIBLE — mitigasi bawaan `config/cors.php` aman)*
  Salin apa adanya ke produksi = stack trace bocor. → Default `APP_DEBUG=false`, perbaiki baris CORS.

## 8. 🧠 Logika Bisnis & Korektness (11)

- [ ] 🔴 **BPBD Provinsi bisa buat API key tapi middleware selalu tolak 403 (key mati sejak lahir)** — `backend/app/Http/Middleware/AuthenticateApiKey.php:35`
  `canGenerateApiKey` true utk non-peneliti + route izinkan `bpbd_provinsi`, tapi whitelist pemakaian hanya `['peneliti','admin']`. Bertentangan dg docblock. → Samakan daftar role.
- [x] ✅ 🟠 **Mode Awam selalu kembalikan `generated_at = null`** — SELESAI (`654b183`): pakai `generated_at` + parse `CarbonImmutable` (kolomnya string timestamptz, tak di-cast).
- [ ] 🟠 **Off-by-one hari: pemilihan 'today' UTC vs notif high-risk WIB** — `backend/app/Http/Controllers/Api/PublicMapController.php:65`
  App tz = UTC; `CarbonImmutable::today()` di PublicMap/Dashboard/PredictionService vs `now('Asia/Jakarta')` di NotifyHighRisk. Jam 00–07 WIB (mencakup ML 06:00 & notif 06:30) beda 1 hari. → Anchor `today('Asia/Jakarta')` konsisten atau set `app.timezone`.
- [ ] 🟠 **Dua command Artisan berbagi nama `ml:predict` — satu membayangi yang lain** — `backend/app/Console/Commands/RunMlPrediction.php:10`
  `RunMlPrediction` (`--simulate`) vs `RunMlPredictions` (`--mode/--timeout`); salah satu jadi dead code. `--simulate` tak dikenal argparse `main.py` → error. → Hapus/rename salah satu.
- [ ] 🟠 **Elevasi/jarak-pantai NULL diperlakukan 0 → faktor spasial 1.0 → risiko maksimum** — `ml-api/main.py:369`
  Wilayah tanpa data spasial tampak LEBIH berisiko dari wilayah elevasi rendah (kebalikan yang diinginkan) → peringatan palsu. → Bedakan 'nol valid' vs 'data hilang'.
- [ ] 🟠 **`confidence_score` tidak konsisten dg `risk_probability` setelah penyesuaian spasial** — `ml-api/main.py:397`
  `risk_probability` dari `final_prob` (× spatial_factor) tapi `confidence` dari prob mentah → "rendah 4%" tapi confidence 80%. → Hitung ulang confidence dari `final_prob`.
- [ ] 🟠 **Tidak ada penguncian pada validate/reject/updateStatus laporan (aksi ganda konkuren)** — `backend/app/Http/Controllers/Api/ReportController.php:231`
  Cek status TOCTOU non-atomik; dua operator/double-click sama-sama lolos → last-write-wins + notif ganda. → `DB::transaction` + `lockForUpdate` / update kondisional.
- [ ] 🟡 **API reference contohkan `risk_probability` 0.82 padahal sistem pakai persen 0..100** — `backend/app/Http/Controllers/Api/ResearchController.php:395`
  Konsumen eksternal salah tafsir skala. → Perbaiki contoh ke skala persen.
- [ ] 🟡 **Status 'duplikat' via `updateStatus` tak catat `validated_by`/`validated_at`** — `backend/app/Http/Controllers/Api/ReportController.php:282`
  Dianggap 'selesai' tanpa jejak siapa/kapan; transisi status juga tak dibatasi. → Isi kolom resolusi + batasi transisi sah.
- [ ] 🟡 **SLA overdue: operator tanpa `region_id` dikirimi SEMUA laporan `perlu_review` se-provinsi** — `backend/app/Services/NotificationService.php:118`
  Fail-open, bertentangan dg `notifyNewReportForReview` yang fail-closed. → Samakan perilaku default.
- [ ] 🟡 **Type hint `RandomForestClassifier` tak diimpor (model sebenarnya XGBoost)** — `ml-api/files/train_model.py:119`
  Anotasi & docstring menyesatkan (lazy annotation → tak crash). → Perbaiki ke `XGBClassifier` + docstring.

## 9. 🧪 Testing & Reliabilitas (9)

- [x] ✅ 🔴 **Alur reset password OTP tidak punya test sama sekali** — SELESAI (`b1908f9`): `OtpPasswordResetTest` 6 tes (hash-only, valid reset + cabut token, wrong→attempts, lockout, expired, anti-enumeration).
- [ ] 🔴 **Login Google OAuth tidak teruji (cabang error & penautan by-email)** — `backend/app/Http/Controllers/Api/GoogleAuthController.php:23`
  Auto-aktif, terbit token, tautan by-email berisiko takeover. → Mock Socialite, uji 3 cabang.
- [ ] 🔴 **Seluruh pipeline ML Python tanpa test; `ml:predict` hanya uji wrapper PHP dg stub** — `backend/tests/Feature/DataImportPipelineTest.php:128`
  `main.py`/`feature_engineering`/`predict_forecast`/`labeler`/`PredictionContract` tanpa pytest. → Suite pytest di `ml-api` + jalankan pada PR `ml-api/**`.
- [ ] 🟠 **CI ML hanya jalan terjadwal ke DB produksi; tanpa validasi pra-merge; cek konektivitas menelan kegagalan** — `.github/workflows/ml-predict.yml:30`
  Dependensi rusak (mis. xgboost) baru ketahuan di produksi; `|| echo GAGAL` tak pernah gagalkan job. → Workflow CI PR (`pip install` + `import` + pytest); buat kegagalan konektivitas benar-benar gagal.
- [ ] 🟠 **Frontend tanpa test unit/komponen; suite Playwright e2e ada tapi tak pernah jalan di CI** — `.github/workflows/frontend-ci.yml:40`
  6 spec e2e nyata (`login/admin/map/province/research/report-flow`) membusuk diam-diam. → Job Playwright di CI (minimal nightly) + Vitest utk komponen kritis.
- [ ] 🟠 **QueueWorkerTest assert hitungan GLOBAL `failed_jobs`/`jobs` di DB test bersama** — `backend/tests/Feature/QueueWorkerTest.php:49`
  `failed_jobs` tak pernah dibersihkan → satu baris sisa run lain gagalkan test. → Scope ke data test / `RefreshDatabase` / assert delta.
- [ ] 🟠 **AuthFlowTest tergantung kuota rate limiter registrasi (margin 1), tanpa reset limiter** — `backend/tests/Feature/AuthFlowTest.php:15`
  Kopling rapuh ke nilai limiter produksi. → `RateLimiter::clear()` di setUp / `withoutMiddleware`.
- [ ] 🟡 **Test fail-safe audit berakhir `assertTrue(true)` tautologis** — `backend/tests/Feature/ApiFoundationTest.php:739`
  Tak memverifikasi apa pun. → `assertDatabaseMissing` / verifikasi state nyata.
- [ ] 🟡 **Test bergantung array cache persisten + data seed di DB test bersama** — `backend/tests/Feature/PublicMapTest.php:21`
  Isolasi manual via nama unik + `Cache::flush()` per test — rapuh. → `RefreshDatabase` / flush cache terpusat di base TestCase.

---

## 10. Tema Lintas-Dimensi (pola berulang)

| Tema | Ringkas | Contoh |
|---|---|---|
| **`env()` saat `config:cache`** | Kunci runtime pakai default diam-diam | rate-limit, `AUDIT_RETENTION_DAYS` |
| **Token/warna CSS tak theme-aware** | Dark mode & highlight mati | `--brand`, `--brand-soft`, `--success`, `rgba(255,255,255,.6)`, picsum |
| **Zona waktu UTC vs Asia/Jakarta** | Pemilihan "hari ini" & timestamp campur | PublicMap/Dashboard/PredictionService vs NotifyHighRisk |
| **Konkurensi tak dijaga** | FE tanpa `active`/Abort; BE tanpa `lockForUpdate` | ProvinceDashboard, polling Operator, validate/reject |
| **Duplikasi tanpa sentralisasi** | Boilerplate berulang | export CSV ×5, parse localStorage ×8, CitizenMode kembar, `normalizeRegency` |
| **Tipe & konstanta longgar** | `any` + magic string | Variants/catch/`api<any>`; tak ada PHP enum |
| **N+1 backend** | Query dalam loop | ResearchController stats, NotificationService, export reporter |
| **Kegagalan ditelan diam-diam** | `catch` tanpa log | PublicMapController, CI ML `\|\| echo`, OAuth redirect |
| **Alur kritis tak teruji** | OTP, OAuth, ML, e2e | + test rapuh (assert absolut, `assertTrue(true)`) |
| **Cluster kelemahan OTP** | plaintext, di-log, tanpa throttle/lockout/cabut-sesi, enumeration | PasswordResetController |

---

*Dihasilkan oleh audit multi-agent (13 agen: 6 review + 6 verify + 1 sintesis) atas commit `df488f0`. Tiap temuan diverifikasi grounded ke kode. Untuk detail bukti (`evidence`) tiap temuan, lihat transkrip workflow.*
