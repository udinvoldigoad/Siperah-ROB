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
> 7. ✅ **Hardening konfigurasi & mass assignment** — `role`/`status`/`google_id` keluar dari `$fillable` User (disetel eksplisit di controller berwenang) + `.env.example` default `APP_DEBUG=false` & CORS tak lagi `*`.
>
> 8. ✅ **Kebijakan akun Google OAuth** — gerbang status + audit log disamakan dengan login email-password, ditutup `GoogleOAuthTest`. Sejak 2026-07-28 kebijakan approval-nya: **pendaftaran mandiri (Google & email/password) langsung aktif sebagai warga**, tanpa antre admin — yang penting kedua jalur identik.
>
> 9. ✅ **Token OAuth keluar dari URL** — redirect membawa kode sekali pakai (TTL 120 dtk, hash di cache); token Sanctum hanya lewat body `POST /auth/google/exchange`.
>
> 10. ✅ **Zona waktu terpusat** — `App\Support\AppTime` jadi satu-satunya anchor hari kalender WIB; 4 sisa titik UTC (usage peneliti, awal bulan dashboard, filter audit) diperbaiki. `app.timezone` tetap UTC secara sengaja.
>
> 11. ✅ **`provinceForecast` diagregasi per tanggal** — endpoint publik anonim tak lagi menarik ~9.600 baris (+ N+1 `is_monitored`); kini ≤30 baris, 1 query, cache 30 menit.
>
> 12. ✅ **Batch UI/UX (9 item)** — AppShell merender `breadcrumbs`/`subtitle`; toast error 12 dtk + jeda saat hover/fokus; dropdown wilayah tak menutup sendiri saat digulung; token `--scrim`/`--accent`/`--low` menggantikan variabel tak terdefinisi; badge status berkapitalisasi; kursor `not-allowed` untuk tombol disabled; Mode Awam berhenti meminta GPS tanpa gestur; antrean operator memakai skeleton; badge risiko peta jadi `<button>` + `aria-label` dipulihkan.
>
> 13. ✅ **Anti-race & routing (3 item)** — penanda urutan request di dashboard Provinsi & Operator; guard izin `App.tsx` jadi fungsi murni, mutasi hash pindah ke `useEffect`.
>
> 14. ✅ **Kebijakan registrasi (keputusan produk)** — pendaftaran mandiri lewat Google **maupun** email/password langsung aktif sebagai `warga`, tanpa antre admin. Gerbang status, larangan klaim peran, dan kesamaan kedua jalur tetap dijaga.
>
> 15. ✅ **Batch pembersihan (8 item)** — debounce pencarian admin; helper `downloadFile()` menggantikan 4 salinan export CSV (+401 kini ditangani terpusat); `shared/auth/session.ts` menggantikan parsing localStorage di 9 file; mock laporan & `MetricCard` mati dihapus; placeholder picsum dibuang + dicabut dari CSP; Nominatim diberi timeout & cek status. Dugaan CSP-vs-Google-Fonts **terbantah** — CSP produksi sudah meng-allowlist keduanya.
>
> **Seluruh prioritas 🔴 selesai.** Sisa 🟠/🟡 terbesar: dedup `CitizenModePage` & sapu `any` (ditunda sengaja, lihat §5), plus cluster N+1 backend di §6.
> Suite backend: **161/161 hijau** · E2E Playwright: **14 lolos, 2 gagal** (`login.spec` warga→`#/` & `research.spec`; keduanya sudah gagal sebelum rangkaian perbaikan ini — belum ditangani).

---

## 1. Ringkasan Eksekutif

Sistem **fungsional & terstruktur**, tetapi menyimpan beberapa cacat serius di lapisan **keamanan auth**, **konsistensi konfigurasi produksi**, dan **korektness lintas-zona-waktu** yang bisa berdampak nyata ke pengguna & integritas data. Pola paling merusak yang berulang:

- `env()` dibaca **saat runtime** → rusak/diam-diam pakai default setelah `config:cache` di produksi.
- Token/warna CSS tak terdefinisi (`--brand`, `--brand-soft`, `--success`) → dark mode & highlight mati.
- Alur **OTP reset kata sandi** lemah: plaintext, di-log, tanpa throttle, tanpa cabut sesi.

Kualitas frontend menengah (banyak `any`, duplikasi boilerplate, fetch tanpa guard anti-race). Cakupan uji rapuh: alur paling kritis (OTP, Google OAuth, pipeline ML) **sama sekali tak teruji**, dan suite e2e Playwright **tak pernah jalan di CI**. Mayoritas temuan **terlokalisasi & actionable** — bisa dicicil cepat tanpa refaktor besar.

---

<!-- ## 2. 🎯 TOP Prioritas (kerjakan dulu)

- [x] ✅ 🔴 **OTP reset-password tanpa throttle + plaintext + banding non-timing-safe → account takeover** — SELESAI (`b1908f9`) — `backend/routes/api.php:22`, `backend/app/Http/Controllers/Api/PasswordResetController.php`
- [x] ✅ 🔴 **`env()` dibaca saat runtime → rate-limit & config diam-diam pakai default setelah `config:cache`** — SELESAI (`2350fc1`): `config/limits.php` baru; provider/ResearchController/PruneAuditLogs baca via `config('limits.*')`. Terverifikasi di produksi dengan config ter-cache (180/20/120/365). **Nol `env()` runtime** tersisa di `app/`,`routes/`,`bootstrap/`,`database/`.
- [x] ✅ 🔴 **Tombol Dashboard salah rute → operator & BPBD provinsi terlempar ke `#/login`** — SELESAI (`db643e7`, oleh rekan tim): kini pakai `dashboardHashForRole()`.
- [x] ✅ 🔴 **Tak ada index pada `ground_truth_reports.status`, FK `region_id`, `audit_logs.actor_user_id`** — SELESAI (`1d7b36e`): 4 index komposit sesuai pola query nyata, via migrasi idempoten + `schema.sql`.
- [x] ✅ 🔴 **Off-by-one hari: peta/dashboard/Mode Awam anchor UTC-`today()` tapi notif high-risk pakai WIB** — SELESAI (lihat §8): anchor terpusat di `App\Support\AppTime`, `app.timezone` tetap UTC secara sengaja, dikunci `AppTimeTest` + `PreDawnDateAnchorTest`.
- [x] ✅ 🔴 **API key buatan BPBD Provinsi ditolak middleware 403 (mati sejak lahir)** — SELESAI (`654b183`): whitelist diselaraskan + test regresi.
- [x] ✅ 🔴 **Koordinat presisi penuh pelapor bocor di endpoint publik** — SELESAI (`efa3118`): pembulatan 3 desimal fail-safe (default aman) di `/public/map` & `/public/mode-awam`; pihak berwenang tetap presisi. 3 test mengunci dua arah.
- [x] ✅ 🔴 **`provinceForecast` kembalikan seluruh prediksi 30 hari tanpa pagination di endpoint publik** — SELESAI (lihat §6): respons diagregasi per tanggal (30 baris), N+1 `is_monitored` lenyap, + cache 30 menit. Dikunci `ProvinceForecastTest`. -->

<!-- ## 3. ⚡ Quick Wins (kecil, berdampak besar)

> Catatan: generator audit menuliskan beberapa item DUA KALI di bagian ini
> (sekali sebagai ringkasan, sekali dengan sitasi `file:line`). Baris kembar
> sudah digabung agar tidak terlihat seperti pekerjaan tersisa.

- [x] ✅ **Fix `roleMap` → pakai `dashboardHashForRole(user.role)`** — SELESAI (`db643e7`, rekan tim)
- [x] ✅ **Ganti `var(--brand)`/`--brand-soft`/`--success` → `var(--accent)`/`--accent-soft`/`--low`** — SELESAI (lihat §4)
- [x] ✅ **Hapus `Log::info` OTP plaintext + pasang `throttle:6,1` di route reset-password** — SELESAI (`b1908f9`)
- [x] ✅ **`$prediction?->created_at` → `->generated_at`** (Mode Awam `generated_at` selalu `null`) — SELESAI (`654b183`): `PublicMapController` memakai `generated_at` + parse `CarbonImmutable` (tabel `predictions` memang tak punya `created_at`; `timestamps=false`). Diverifikasi ulang di produksi: `generated_at` terisi `2026-07-27T23:00:30+00:00`, bukan `null`.
- [x] ✅ **`setWaterHeight("")` (bukan `"45"`) setelah submit** — SELESAI (`623b171`, rekan tim)
- [x] ✅ **`.btn:disabled { cursor: not-allowed }`** (sisakan `wait` khusus loading) — SELESAI (lihat §4) -->

---

<!-- ## 4. 🎨 UI/UX & Desain (14)

- [x] ✅ 🔴 **AppShell mengabaikan prop `breadcrumbs` & `subtitle`** — SELESAI: keduanya kini dirender. `breadcrumbs` menggantikan jejak hardcoded di topbar (fallback ke "beranda › judul" untuk halaman yang tak mengirimnya, dengan `nowrap` + ellipsis agar topbar 52px tak melar); `subtitle` tampil sebagai `.app-subtitle` di atas konten, lengkap dengan padding tepi khusus mobile karena `.app-content` kehilangan padding samping di <768px. Perubahan terbatas di `AppShell.tsx` + `tokens.css` — 8 halaman pemanggil tak disentuh, **kecuali** `PublicMapPage` yang ternyata sudah menulis ulang kalimat subjudulnya sendiri sebagai `<motion.p>` sehingga tampil dobel setelah prop-nya benar-benar dirender; paragraf itu dihapus. Diverifikasi lewat spec Playwright sementara: kelima halaman ber-`subtitle` (`#/map`, `#/awam`, `#/notifications`, `#/history`, `#/reports`) menampilkan kalimatnya **tepat sekali** (hitung kemunculan di `document.body.innerText`, bukan hanya cek elemen AppShell), desktop 1280px & mobile 390px.
- [x] ✅ 🔴 **Tombol Dashboard di landing salah rute utk operator/provinsi** — SELESAI sebelumnya oleh rekan tim (`db643e7`): `PortalPage` sudah memakai `dashboardHashForRole()`. Diverifikasi lewat e2e (operator → `#/operator`, provinsi → `#/province`).
- [x] ✅ 🔴 **Chip Wilayah Pantau tak terbaca (dark mode): `--brand` hitam, `--brand-soft` tak ada** — SELESAI: `.ns-chip` (latar/border/teks) + ikon Wilayah Pantau pindah ke `--accent`/`--accent-soft`. Diverifikasi di dark mode: warna teks & border `rgb(99,102,241)`, latar tidak lagi transparan penuh.
- [x] ✅ 🟠 **Variabel CSS `--success` tak terdefinisi → highlight hijau hilang** — SELESAI: kedua pemakaian (`ReportHistoryPage` badge "Pantauan ROB", ikon "Berlangganan Peristiwa") diganti `--low`. Diverifikasi warnanya kini emerald `rgb(16,185,129)`. Nol sisa `var(--success)`/`var(--brand-soft)` di codebase.
- [x] ✅ 🟠 **Kursor `wait` (jam pasir) pada SEMUA tombol disabled** — SELESAI: `.btn:disabled` → `not-allowed`, `wait` disisakan untuk `.btn[data-loading]`. Agar aturan itu tak jadi CSS mati, `data-loading` disambungkan ke 13 tombol yang benar-benar menunggu server (submit laporan, simpan pengguna/notifikasi, approve/reject, validasi laporan, permohonan izin, deteksi lokasi) — memakai `x || undefined` supaya atributnya hilang saat idle, bukan jadi `data-loading="false"`.
- [x] ✅ 🟠 **KPI 'Menunggu Approval' admin tak pernah ter-highlight (`.metric-card.warning` tak ada)** — SELESAI: kelas diganti ke `medium` (amber `--medium`, sudah ada di tokens.css). Diverifikasi warna angkanya benar-benar `rgb(245,158,11)` saat ada akun berstatus menunggu.
- [x] ✅ 🟠 **Mode Awam minta izin GPS otomatis saat halaman dibuka** — SELESAI: `useEffect(requestGpsLocation, [])` dihapus. Sebagai gantinya `navigator.permissions.query({name:'geolocation'})` — query ini TIDAK memunculkan dialog — hanya melanjutkan lokasi otomatis bila izinnya sudah diberikan di kunjungan sebelumnya; pengunjung baru menunggu tombol "Gunakan lokasi perangkat". Browser tanpa Permissions API jatuh ke manual.
- [x] ✅ 🟠 **State loading tidak konsisten: teks polos vs skeleton** — SELESAI: antrean laporan operator kini `LoadingBlock` (sama dengan Admin/Riwayat/Audit/Peneliti). Sisa teks "Memuat…" yang ada bukan daftar/tabel — overlay peta (tak bisa di-skeleton, warnanya diperbaiki di item `--scrim`) dan placeholder nilai inline di banner ProvinceDashboard/Mode Awam/Onboarding, jadi sengaja dibiarkan.
- [x] ✅ 🟠 **Badge risiko di peta tak bisa diaktifkan lewat keyboard** — SELESAI: elemennya kini `<button>` native (bukan `div` ber-`role=button`), jadi Enter/Space bekerja tanpa handler keydown tambahan; gaya bawaan tombol direset agar lingkaran 30px tetap presisi, plus `:focus-visible`. **Temuan tambahan saat verifikasi:** `Marker.addTo()` maplibre menimpa `aria-label` elemen dengan "Map marker", sehingga SEMUA badge terbaca sama oleh pembaca layar — label deskriptif kini dipasang ulang setelah `addTo()`.
- [x] ✅ 🟠 **Checkbox 'Ingat saya' di login tidak berfungsi** — SELESAI sebelumnya oleh rekan tim (`f910067`): checkbox dihapus beserta komentar alasannya. Diverifikasi tak ada sisa di codebase.
- [x] ✅ 🟠 **Toast error hilang otomatis 4 detik tanpa pause-on-hover** — SELESAI: timer pindah dari provider ke tiap `ToastItem` sehingga bisa dijeda. Error kini 12 detik (sukses/info tetap 4), dan hitungan berhenti selama kursor menyentuh **atau** fokus keyboard ada di dalam toast (`onFocusCapture`, agar tab ke tombol tutup juga menjeda); sisa waktu dilanjutkan, bukan diulang, dengan lantai 2 detik supaya tak langsung lenyap saat kursor pergi.
- [x] ✅ 🟡 **Overlay loading peta pakai putih hardcoded (silau di dark mode)** — SELESAI: token baru `--scrim` (putih 60% di terang, slate-900 65% di gelap) menggantikan `rgba(255,255,255,.6)`, plus `color: var(--ink)` agar teks "Memuat peta" ikut kontras. Putih hardcoded lain yang tersisa ada di panel hero login/lupa-sandi yang memang berlatar gelap permanen — bukan kasus yang sama.
- [x] ✅ 🟡 **Badge status pengguna menampilkan teks mentah huruf kecil** — SELESAI: `shared/constants/userStatus.ts` baru (sejajar `roleLabels`) memetakan enum Postgres huruf kecil ke label berkapitalisasi; dipakai badge tabel **dan** dropdown filter yang sebelumnya mengulang keempat label secara hardcoded.
- [x] ✅ 🟡 **Form laporan mengisi ulang tinggi air ke '45' setelah submit** — SELESAI sebelumnya oleh rekan tim (`623b171`): `setWaterHeight("")` + komentar alasannya. Diverifikasi masih benar. -->

## 5. ⚛️ Frontend (React/TS) (13)

- [x] ✅ 🔴 **ProvinceDashboardPage fetch tanpa guard `active`/AbortController → data bisa tertukar** — SELESAI: penanda urutan `fetchSeqRef` (pola sama dengan `AdminUsersPage`) — hanya respons request terakhir yang boleh menulis state, termasuk `setIsLoading(false)` agar request lama tak mematikan spinner milik request baru. Diverifikasi e2e dengan menahan respons filter LAMA 4 detik; test terbukti gagal saat guard-nya sengaja dilepas.
- [x] ✅ 🔴 **Polling 30 detik OperatorDashboard memaksa balik ke halaman 1** — SELESAI: bagian "halaman aktif" sudah diperbaiki rekan tim (`cf48255`, polling senyap memakai `pageRef.current`); **guard anti-race**-nya yang belum ada ditambahkan di sini (`loadSeqRef`), sebab polling 30 detik masih bisa mendarat setelah operator berpindah halaman/filter dan menimpanya — termasuk merusak baseline notifikasi "laporan baru".
- [x] ✅ 🟠 **App.tsx efek samping (redirect + baca localStorage) saat render** — SELESAI: logika izin dipisah jadi `guardRedirect()` yang MURNI menghitung tujuan (tak menyentuh `window.location`), mutasi hash pindah ke `useEffect`. `route` ikut jadi dependensi karena dua rute terlarang berbeda bisa menghasilkan tujuan sama (`#/login`) sehingga efeknya tak akan berjalan lagi. Selagi redirect berjalan halaman terlarang tidak dirender (placeholder). Dikunci 3 tes e2e: tamu → `#/login`, peran salah → `#/`, `reset-password` → `#/forgot-password`.
- [ ] 🟠 **CitizenMode Desktop & Mobile hampir identik, props `: any`** — `frontend/src/features/public-map/CitizenModePage.tsx:244` *(DITUNDA sengaja — refactor, bukan bug)*
  Duplikasi JSX (forecast/actionCards/nearby) harus diedit dua kali. → Ekstrak sub-komponen + tipe props.
  **Ukuran terukur:** file 1.053 baris; `CitizenModeDesktop` ~300 baris JSX & `CitizenModeMobile` ~290 baris, 13 props identik semuanya `: any`. Ini halaman publik yang paling banyak dilihat warga dan tak punya test komponen, jadi sengaja dipisah dari batch perbaikan bug agar kegagalannya tidak menyeret 16 perbaikan lain saat revert.
- [ ] 🟠 **Penggunaan `any` tersebar luas (Variants, catch, `api<any>`, GeoJSON)** — `frontend/src/features/admin/AuditLogPage.tsx:52` *(DITUNDA sengaja — refactor, bukan bug)*
  Melumpuhkan type-check padahal tipe konkret sudah ada. → `Variants`, tipe respons konkret, `catch(err: unknown)`.
  **Ukuran terukur:** 54 lokasi di 14 file (10 CitizenModePage · 6 AdminUsersPage · 5 ResearchPortal · 5 OperatorDashboard · 5 ForgotPassword · 3 `client.ts` · dst). Sebagian tumpang tindih dengan item di atas, jadi paling efisien dikerjakan bersamanya.
- [x] ✅ 🟠 **Pencarian pengguna admin memicu request tiap ketikan (tanpa debounce)** — SELESAI: state `search` (responsif di input) dipisah dari `appliedSearch` (yang dikirim ke API), dijembatani debounce 350 ms. Reset halaman ikut pindah ke debounce agar paginasi tak melompat tiap huruf. Diverifikasi e2e: mengetik 8 karakter menghasilkan ≤2 request (sebelumnya 8).
- [x] ✅ 🟠 **Boilerplate export CSV terduplikasi di 5 file, URL tidak konsisten, bypass `api()`** — SELESAI: `downloadFile()` di `shared/api/client.ts` menggantikan 4 blok salinan (~20 baris masing-masing) di Admin/Audit/Operator/Provinsi. Dua gaya URL (`${apiBase}/...` vs `apiUrl('/api/...')`) disatukan, dan **401 kini diperlakukan sama dengan `api()`** — sesi dibersihkan lalu diarahkan login, bukan cuma toast "Export gagal (401)". `URL.revokeObjectURL` dipindah ke `finally` supaya blob tak menggantung saat unduhan gagal.
- [x] ✅ 🟠 **`picsum.photos` placeholder + CSS mati `.inline-pill-img` + properti `align-middle` invalid** — SELESAI: kelas `.inline-pill-img` tak pernah dipakai di JSX mana pun (hanya dideklarasikan + di-`display:none`-kan di media query), jadi kedua bloknya dihapus. Sekalian **`https://picsum.photos` dicabut dari `img-src` CSP** di `backend/public/.htaccess` — allowlist-nya tak lagi punya alasan untuk ada. Diverifikasi e2e: nol request ke picsum saat portal dibuka.
- [x] ✅ 🟡 **Data laporan dummy hardcoded ikut ke produksi via `findOperatorReport`** — SELESAI: 61 baris mock + `findOperatorReport()` dihapus; `ReportDetailPage` selalu mulai `undefined` + skeleton. Diverifikasi e2e dengan memaksa API balas 500: nama fiktif ("Panjang Utara", "Rudi Hartono") tak lagi muncul.
- [x] ✅ 🟡 **Komponen `MetricCard` tidak pernah diimpor (file mati)** — SELESAI: dihapus. Halaman yang ada memakai kartu KPI inline dengan animasi framer-motion masing-masing, jadi memaksa memakai komponen ini justru menurunkan kualitas tampilan.
- [x] ✅ 🟡 **Parsing user dari localStorage diduplikasi di 8 file tanpa helper terpusat** — SELESAI: `shared/auth/session.ts` (`getToken`/`getCurrentUser`/`isLoggedIn`/`setSession`/`clearSession`) dipakai di **9** file. `getCurrentUser()` juga memvalidasi bentuknya, bukan hanya `JSON.parse` — data sesi versi lama/rusak kini dianggap "belum login" alih-alih menghasilkan objek separuh jadi. Diverifikasi e2e dengan sengaja merusak `siperah-user`: pengguna diarahkan ke login, bukan crash.
- [x] ✅ 🟡 **Reverse-geocode ke Nominatim tanpa AbortController / handling rate-limit** — SELESAI: `AbortController` + timeout 8 detik, dan status non-OK (429/5xx) diperiksa eksplisit — sebelumnya body error ikut di-`json()` lalu lolos sebagai "alamat". Kegagalan apa pun jatuh ke label generik; koordinatnya sendiri sudah didapat sebelum langkah ini, jadi fitur intinya tak terganggu.
- [x] ❌ 🟡 **Google Fonts (Inter) dari CDN berpotensi diblok CSP produksi** — **TIDAK BERLAKU (diverifikasi di produksi).** Header CSP live sudah meng-allowlist keduanya secara eksplisit: `style-src ... https://fonts.googleapis.com` dan `font-src ... https://fonts.gstatic.com` (sumbernya `backend/public/.htaccess`, bukan file yang tak ada seperti dugaan audit). Tak ada yang perlu diubah — dugaan `PLAUSIBLE`-nya terbantah, bukan dikerjakan.

## 6. 🛠️ Backend (Laravel) (13)

- [x] ✅ 🔴 **`env()` dipakai saat runtime → nilai `.env` diabaikan setelah `config:cache`** — SELESAI (`2350fc1`): semua pindah ke `config/limits.php`.
- [x] ✅ 🔴 **Tak ada index pada `ground_truth_reports.status`, FK `region_id`, `audit_logs.actor_user_id`** — SELESAI (`1d7b36e`):
  `reports_user_created_idx (user_id,created_at)` · `reports_status_created_idx (status,created_at)` · `reports_region_idx (region_id)` · `audit_logs_actor_idx (actor_user_id,created_at)`.
- [ ] 🔴 **N+1 count query per dataset di `ResearchController::stats` & `datasets`** — `backend/app/Http/Controllers/Api/ResearchController.php:268`
  1 COUNT (predictions/reports/tidal) per dataset tiap buka halaman statistik. → Hitung agregat sekali + cache.
- [x] ✅ 🔴 **`provinceForecast` kembalikan seluruh prediksi 30 hari tanpa pagination** — SELESAI: respons kini **diagregasi per tanggal** (≤30 baris: `avg/max_probability`, `high_risk_count`, `critical_count`, `region_count`) + amplop `meta`, sejajar `trend_30_days` dashboard provinsi. Ditambah cache 30 menit.
  **Lebih parah dari yang tercatat audit:** tiap baris lama melewati `RegionResource`, yang menghitung `is_monitored` via `predictions()->exists()` — satu permintaan **anonim** bisa memicu ~9.600 query, bukan sekadar payload besar. Terukur setelah perbaikan: **1 query** untuk 50 baris mentah.
  Bentuk respons berubah (breaking), diambil setelah dipastikan **tak ada konsumen**: nol pemanggilan di frontend dan endpoint ini tidak tercantum di `docs/operations/api-contract.md` (kontrak itu hanya mencakup `/api/v1/*`). Dikunci `ProvinceForecastTest` (4 tes: bentuk agregat, batas jumlah query, jendela 30 hari, filter regency).
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

<!-- ## 7. 🔐 Keamanan & Integritas Data (9)

- [x] ✅ 🔴 **Endpoint verifikasi OTP reset-password tanpa rate limit → brute force** — SELESAI (`b1908f9`): `throttle:6,1` + counter lockout 5× + `Hash::check` timing-safe.
- [x] ✅ 🟠 **Forgot-password membocorkan keberadaan email (user enumeration)** — SELESAI (`b1908f9`): respons seragam di sendOtp & resetWithOtp (terverifikasi live).
- [x] ✅ 🟠 **OTP disimpan plaintext di DB & ditulis ke log aplikasi** — SELESAI (`b1908f9`): kolom `otp` diisi `null`, `Log::info` OTP dihapus, verifikasi via hash `token`.
- [x] ✅ 🟠 **Reset kata sandi tidak mencabut token/sesi Sanctum** — SELESAI (`b1908f9`): `$user->tokens()->delete()` setelah reset.
- [x] ✅ 🟠 **Token Sanctum dikirim lewat query string URL pada callback Google OAuth** — SELESAI: callback kini meredirect `?code=<sekali-pakai>` (acak 64 char, disimpan sebagai hash SHA-256 di cache, TTL 120 detik, hangus lewat `Cache::pull`). SPA menukarnya di `POST /auth/google/exchange` (throttle 10/menit) dan menerima token di **body** respons; token, `last_login_at`, & audit sukses pindah ke titik tukar itu, plus cek ulang status akun di sana. 3 tes baru mengunci: URL tak pernah memuat token, kode hanya sah sekali, dan akun yang dinonaktifkan setelah redirect tetap ditolak 403.
- [x] ✅ 🟠 **Callback Google OAuth abaikan status akun (signup auto-aktif, lewati approval)** — SELESAI: **gerbang status** dipasang (akun `menunggu`/`nonaktif`/`ditolak` tak pernah dapat token, sebelumnya tak diperiksa sama sekali) dan alurnya menulis audit log (`register` success / `login` success·denied, `provider: google`) seperti login email-password.
  **Kebijakan approval-nya sendiri: keputusan produk (2026-07-28) — pendaftaran mandiri LANGSUNG AKTIF sebagai warga, baik lewat Google maupun email/password.** Yang jadi inti temuan audit adalah *ketimpangan* antara kedua jalur; keduanya kini identik, jadi tak ada lagi jalur yang lebih longgar untuk dieksploitasi. Peran di atas warga tetap hanya bisa diberikan admin, dan admin tetap bisa menonaktifkan/menolak akun kapan pun. `GoogleOAuthTest` mengunci: signup baru → `warga`+`aktif` & dapat kode tukar, akun aktif → token + `google_id` tertaut, ketiga status non-aktif → ditolak & teraudit, serta signup mandiri tak pernah bisa mengklaim peran istimewa.
  Sisa terkait (belum dikerjakan): callback belum memeriksa `email_verified` dari Google sebelum menautkan akun berdasarkan email.
- [x] ✅ 🟠 **Koordinat presisi penuh pelapor bocor di endpoint publik** — SELESAI (`efa3118`): `ReportResource` membulatkan 3 desimal secara **default**, presisi penuh hanya bila `$request->user()` ada → endpoint publik baru otomatis aman. Titik `/public/map` ikut dibulatkan. Dokumen kontrak API diperbarui.
- [x] ✅ 🟡 **Kolom `role`/`status`/`google_id` ada di `$fillable` User (risiko laten mass assignment)** — SELESAI: ketiganya dikeluarkan dari `$fillable`; Auth/Admin/GoogleAuth controller menyetelnya eksplisit (`$user->role = ...`), fixture test pakai `User::forceCreate()`. `UserMassAssignmentTest` mengunci invarian (`isFillable()` false + `fill()` mengabaikan) untuk ketiga kolom.
- [x] ✅ 🟡 **`APP_DEBUG=true` default di `.env.example` (+ baris CORS malformed)** — SELESAI: default `APP_DEBUG=false` (+ catatan setel `true` hanya di dev lokal); `CORS_ALLOWED_ORIGINS=*` diganti contoh terkomentari agar `config/cors.php` memakai default aman (APP_URL) — termasuk peringatan bahwa nilai kosong justru menimpa default dengan daftar kosong. -->

## 8. 🧠 Logika Bisnis & Korektness (11)

- [ ] 🔴 **BPBD Provinsi bisa buat API key tapi middleware selalu tolak 403 (key mati sejak lahir)** — `backend/app/Http/Middleware/AuthenticateApiKey.php:35`
  `canGenerateApiKey` true utk non-peneliti + route izinkan `bpbd_provinsi`, tapi whitelist pemakaian hanya `['peneliti','admin']`. Bertentangan dg docblock. → Samakan daftar role.
- [x] ✅ 🟠 **Mode Awam selalu kembalikan `generated_at = null`** — SELESAI (`654b183`): pakai `generated_at` + parse `CarbonImmutable` (kolomnya string timestamptz, tak di-cast).
- [x] ✅ 🟠 **Off-by-one hari: pemilihan 'today' UTC vs notif high-risk WIB** — SELESAI. Anchor peta/dashboard/PredictionService sudah disamakan ke WIB oleh rekan tim (`5f93d77`, sesudah commit yang diaudit); sisanya diselesaikan di sini: `App\Support\AppTime` jadi satu-satunya sumber kebenaran zona waktu (semua literal `'Asia/Jakarta'` untuk anchor tanggal dialihkan ke sana), plus 4 titik yang masih UTC — `ResearchController::usage` (ember harian `CAST(created_at AS date)` → `AT TIME ZONE`), `DashboardController` awal-bulan operator & provinsi, dan filter `from`/`to` `AuditController`. `app.timezone` sengaja TETAP UTC (alasan didokumentasikan di `AppTime`: mengubahnya menggeser semua penulisan `timestamptz` baru 7 jam). Dikunci `AppTimeTest` + `PreDawnDateAnchorTest` (waktu uji 23:30 UTC = 06:30 WIB; keempatnya terbukti gagal saat anchor dikembalikan ke UTC).
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
- [ ] 🔴 **Login Google OAuth tidak teruji (cabang error & penautan by-email)** — `backend/app/Http/Controllers/Api/GoogleAuthController.php:23` *(SEBAGIAN — `GoogleOAuthTest` (6 tes) menutup signup baru, penautan by-email, 3 status non-aktif, serta seluruh alur kode-tukar; stub Socialite via `Socialite::extend()`, tanpa Mockery)*
  Tersisa: cabang `catch` (`?error=google_auth_failed`) dan penolakan email Google yang belum terverifikasi.
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
