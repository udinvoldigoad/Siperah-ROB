# Checklist Production Readiness SIPERAH-RoB

Dokumen ini dipakai sebagai daftar kerja backend dan frontend sampai SIPERAH-RoB siap production dan kebutuhan PRD/SKPL terimplementasi rapi. Checklist disusun dari PRD `docs/PRD_SIPERAH-RoB.md`, audit kode terakhir, dan kondisi implementasi repo saat ini.

Status:

- `[x]` sudah tersedia/terlihat terimplementasi
- `[~]` sebagian sudah ada, tetapi belum production-ready
- `[ ]` belum ada atau masih perlu keputusan/data/integrasi

## Ringkasan prioritas

1. Bereskan data inti: wilayah BIG, pasang surut, prediksi harian, laporan tervalidasi, metadata provenance.
2. Samakan logika monitoring/pantauan di seluruh backend, dashboard, peta, laporan, dan notifikasi.
3. Lengkapi layer peta publik: infrastruktur kritis, jalur evakuasi, pasang surut BMKG, peringatan aktif BMKG.
4. Selesaikan portal peneliti: download dataset, API key, statistik pemakaian real, dokumentasi API, lisensi/perizinan.
5. Selesaikan notifikasi production: browser push/email/WhatsApp/SMS, quiet hours, subscription wilayah, retry queue.
6. Bereskan audit, keamanan, RBAC, rate limit, test coverage, monitoring, backup, deploy, dan hygiene repo.

---

## A. Backend checklist

### A1. Fondasi production

- [ ] Pastikan `.env.production` terdokumentasi tanpa secret asli.
- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` valid.
- [ ] Konfigurasi CORS production hanya domain frontend resmi.
- [ ] Konfigurasi Sanctum/session cookie sesuai domain production.
- [ ] Secret rotation plan untuk `APP_KEY`, token API, kredensial DB, kredensial email/WA/SMS.
- [ ] Queue driver production disiapkan, misalnya Redis/database queue.
- [ ] Scheduler production aktif via cron/supervisor.
- [ ] Log channel production disiapkan dengan retention.
- [ ] Backup DB dan storage foto laporan disiapkan.
- [ ] Health check endpoint backend tersedia.
- [ ] Dokumentasi deploy backend tersedia.

### A2. Database, migration, dan seed

- [x] Migration schema utama tersedia.
- [x] Seeder demo tersedia.
- [~] Seeder deterministic sudah ada, tetapi perlu dipastikan tidak dipakai sebagai data production.
- [~] Migration PostGIS tersedia, tetapi perlu fallback/strategi MySQL jika branch migrasi MySQL dipakai.
- [ ] Semua migration idempotent dan aman untuk deploy bertahap.
- [ ] Index untuk query berat dipastikan: `predictions`, `regions`, `ground_truth_reports`, `audit_logs`, `notification_inbox`.
- [ ] Foreign key dan cascade dicek ulang untuk report photos, api keys, notifications.
- [ ] Data `frontend/dist` diputuskan: tidak ikut Git atau memang bagian artefak deploy.
- [ ] Data seed demo dipisah jelas dari seed reference production.
- [ ] Test migration fresh + seed + rollback di CI.

### A3. Data wilayah, BIG, dan provenance

- [x] Ada pipeline/sinkronisasi BIG dan metadata provenance.
- [x] Ada service klasifikasi pesisir/coastline.
- [~] Cakupan wilayah Lampung perlu diaudit sampai 15 kabupaten/kota dan 283+ kelurahan pesisir.
- [ ] Data wilayah production dari BIG harus tervalidasi, bukan hanya dummy/manual.
- [ ] Boundary status wajib jelas: official/estimated/manual/invalid.
- [ ] Audit kualitas data wilayah: geometri kosong, geometri invalid, duplikasi nama, missing kode wilayah.
- [ ] Fallback ketika BIG API gagal: cache, retry, dan laporan error.
- [ ] Dokumentasi sumber data BIG dan tanggal sinkronisasi.

### A4. Data pasang surut, BMKG, dan cuaca

- [x] Ada model/tabel/pipeline data pasang surut.
- [~] Import pasang surut lokal sudah ada, tetapi cakupan belum merata seluruh Lampung.
- [ ] Integrasi sumber BMKG resmi untuk prakiraan cuaca.
- [ ] Integrasi peringatan dini cuaca BMKG.
- [ ] Integrasi data gempa/tsunami BMKG jika relevan dengan peringatan pesisir.
- [ ] Integrasi data pasang surut real/historis yang sumbernya jelas.
- [ ] Normalisasi satuan, datum, timestamp, timezone Asia/Jakarta.
- [ ] Validasi kualitas tidal: missing value, outlier, duplikasi timestamp, station metadata.
- [ ] Jadwal refresh harian pukul 05:00 WIB.
- [ ] Jadwal refresh 2x/hari saat event astronomis signifikan.

### A5. Prediksi risiko / model output

- [x] Endpoint prediksi publik tersedia.
- [x] Struktur prediksi harian tersedia.
- [~] Prediksi masih perlu dipastikan berasal dari pipeline ML resmi, bukan demo seeder.
- [ ] Kontrak data output model ML final: horizon, region_id, probability, risk_class, confidence, generated_at.
- [ ] Validasi model version dan provenance untuk setiap prediksi.
- [ ] Import prediksi harian otomatis.
- [ ] Handling jika prediksi hari ini belum tersedia.
- [ ] Evaluasi akurasi model, precision, recall, dan drift tracking.
- [ ] Audit log untuk update model/prediksi.
- [ ] Endpoint/internal command untuk refresh operational data production.

### A6. Portal publik dan peta risiko (`FR-PUB`)

- [x] Endpoint peta publik tersedia.
- [x] Endpoint prediksi publik tersedia.
- [x] Export peta publik tersedia di backend.
- [~] Layer zona bahaya dan laporan ground truth tersedia.
- [~] Layer pasang surut/coastline tersedia sebagian.
- [ ] Layer infrastruktur kritis belum production-ready.
- [ ] Layer jalur evakuasi belum production-ready.
- [ ] Banner peringatan aktif BMKG belum terhubung sumber resmi.
- [ ] Horizon hari ini, +1, +2, +3, +7 harus konsisten backend/frontend.
- [ ] Detail wilayah harus menampilkan nama, kelas bahaya, probabilitas, estimasi populasi.
- [ ] Rate limit publik disesuaikan untuk traffic production.
- [ ] GeoJSON response size perlu dipantau/cache agar peta cepat.

### A7. Mode Awam (`FR-AWAM`)

- [x] Endpoint mode awam tersedia.
- [x] Prakiraan 7 hari tersedia dari service prediksi.
- [x] Laporan sekitar lokasi ditampilkan.
- [x] Query laporan terdekat sudah dibuat lebih tahan tanpa kolom `location`.
- [x] Fallback non-PostGIS untuk laporan terdekat memakai bounding box + jarak Haversine.
- [x] Bahasa respons non-teknis tersedia lewat `guidance_message` dan dipakai UI Mode Awam.
- [ ] Geolokasi manual/otomatis harus diuji desktop dan mobile.
- [x] Jika lokasi di luar pantauan, pesan dan status jelas tanpa memakai lokasi pesisir terdekat sebagai nama palsu.
- [x] Test untuk titik di dalam/luar area pantauan tersedia.

### A8. Pelaporan ground truth (`FR-GT`)

- [x] Endpoint daftar, detail, submit, validasi, tolak laporan tersedia.
- [x] Upload foto tersedia.
- [x] Severity backend dihitung dari tinggi genangan.
- [x] Laporan luar area pantauan masuk `perlu_review`.
- [x] UI dibuat jelas bahwa severity otomatis dari tinggi air, bukan pilihan manual yang membingungkan.
- [x] Validasi ukuran/jumlah foto dan MIME type production-safe: maksimal 5 foto, JPG/PNG, 2MB per foto.
- [~] Storage foto production memakai public disk; cloud storage/signed URL masih perlu keputusan deployment jika datanya sensitif atau traffic besar.
- [x] Deduplication laporan: laporan warga yang terlalu dekat lokasi+waktu ditolak dengan pesan riwayat yang jelas.
- [x] SLA 1x24 jam punya query overdue, filter API, dan notifikasi berkala ke BPBD/admin.
- [x] Validasi laporan menulis audit lewat AuditService.
- [x] Setelah validasi, laporan konsisten muncul di peta publik dan dataset peneliti.
- [x] Test laporan di luar wilayah pantauan tetap masuk antrean triase.

### A9. Dashboard BPBD Operator (`FR-OPS`)

- [x] Summary operator tersedia.
- [x] Antrean laporan `menunggu` dan `perlu_review` sudah disamakan.
- [x] Validasi/tolak/detail tersedia.
- [~] Status bahaya wilayah operator tersedia, tetapi perlu audit data wilayah kerja.
- [~] Filter eksplisit wilayah kerja operator di UI/backend perlu dipastikan.
- [X] Alert laporan baru perlu dihubungkan dengan notifikasi/realtime/polling.
- [X] KPI harus sama dengan daftar laporan aktual.
- [X] Export laporan operator perlu diuji di UI.
- [X] Hak akses operator untuk laporan luar wilayah harus sesuai SOP triase.

### A10. Dashboard BPBD Provinsi (`FR-PROV`)

- [x] Summary provinsi tersedia.
- [x] Export CSV backend dan tombol frontend tersedia.
- [x] Tabel risiko per kabupaten tersedia.
- [~] Grafik tren tersedia, tetapi perlu dipastikan 30 hari sesuai definisi PRD.
- [x] Filter periode bulan dan kabupaten belum lengkap.
- [x] Sorting tabel harus benar-benar interaktif.
- [x] Tren naik/turun/stabil perlu definisi matematis, bukan sekadar ada/tidak risiko.
- [~] Populasi risiko harus berbasis data BPS/region yang valid.
- [x] Top 10 wilayah terdampak harus berdasarkan prediksi terbaru dan cakupan data lengkap.

### A11. Admin dan manajemen akses (`FR-ADM`)

- [x] Admin list user tersedia.
- [x] Approve/reject/update user tersedia.
- [x] Admin dapat ubah role/status dan tambah user manual.
- [x] Admin tambah pengguna baru (`FR-ADM-1`) tersedia di backend dan UI.
- [x] Region assignment untuk operator wajib dan tervalidasi.
- [~] Workflow perizinan peneliti jelas untuk institusi dan status approval; alasan akses naratif terpisah butuh kolom/migration tambahan jika SKPL mewajibkan.
- [x] Audit setiap perubahan user memakai AuditService fail-safe.
- [x] Admin export user/audit tersedia.
- [x] RBAC negatif dites: warga tidak boleh akses admin/research, peneliti tidak boleh akses dashboard BPBD.

### A12. Audit log (`FR-ADM-3`, `FR-ADM-4`)

- [x] Audit log table dan viewer tersedia.
- [x] AuditService tersedia.
- [~] Beberapa aksi sudah diaudit.
- [x] Semua aksi penting wajib diaudit: login sukses/gagal, logout, submit laporan, validasi, tolak, update status, export, API key, update user, update model/prediksi.
- [x] Audit failure/denied harus terekam tanpa menggagalkan request utama jika audit storage bermasalah.
- [x] Filter action/outcome/date/user/role harus diuji.
- [x] Search audit harus konsisten.
- [x] Export audit log belum dipastikan.
- [x] Retention policy audit production.

### A13. Portal peneliti dan API (`FR-PEN`)

- [x] Dataset list tersedia.
- [x] Download dataset login-auth tersedia.
- [x] API key list/regenerate tersedia.
- [x] Referensi API tersedia.
- [~] Statistik pemakaian tersedia sebagian.
- [ ] API calls today harus benar-benar per hari, bukan lifetime counter.
- [ ] Usage per endpoint 30 hari untuk tab “Penggunaan API”.
- [ ] Lisensi/perizinan data sebagai tab terpisah.
- [ ] Dataset filter kabupaten perlu dukungan metadata region/dataset.
- [ ] API `/api/v1/*` harus stabil, terdokumentasi, dan punya contoh request/response.
- [ ] API key middleware harus mencatat use_count, last_used_at, endpoint, outcome.
- [ ] Rate limit API key perlu disesuaikan production.
- [ ] CSV/JSON harus aman dari CSV injection dan data sensitif.

### A14. Notifikasi (`FR-NOTIF`)

- [x] Notification inbox tersedia.
- [x] Settings kanal/event/quiet hours/wilayah tersedia secara data.
- [~] Notifikasi laporan/status masuk inbox.
- [ ] Browser push production belum lengkap.
- [ ] Email production belum lengkap.
- [ ] WhatsApp production belum lengkap.
- [ ] SMS khusus operator belum lengkap.
- [ ] Quiet hours harus benar-benar menahan notifikasi non-kritis.
- [ ] Peringatan kritis harus bypass quiet hours.
- [ ] Subscription wilayah harus difilter secara konsisten dengan region.
- [ ] Retry queue dan failure logging untuk kanal eksternal.
- [ ] Template pesan tiap event.

### A15. Onboarding dan FAQ (`FR-OB`)

- [x] Endpoint onboarding tersedia.
- [~] Landing/panduan sudah dipoles, tetapi perlu dicocokkan lagi dengan PRD/SKPL.
- [ ] FAQ akurasi model, sumber data, hak akses, dan frekuensi update harus lengkap.
- [ ] Konten edukasi harus bahasa awam dan mobile-friendly.
- [ ] CTA lapor harus login jika belum autentikasi.

### A16. Keamanan backend

- [x] Sanctum auth tersedia.
- [x] Role middleware tersedia.
- [x] Login/register throttle tersedia.
- [~] Rate limit API key tersedia.
- [ ] Password reset/lupa kata sandi belum jelas.
- [ ] Policy atau authorization test per endpoint.
- [ ] File upload harus scan/validasi extension dan ukuran.
- [ ] SQL portability Postgres/MySQL diaudit.
- [ ] Validasi input semua endpoint.
- [ ] No debug shortcut di production.
- [ ] Security headers di reverse proxy/frontend host.
- [ ] Dependency audit Composer.

### A17. Testing backend

- [x] PHPUnit berjalan.
- [~] Test regression dasar tersedia.
- [ ] Test auth/RBAC semua role.
- [ ] Test public map.
- [ ] Test resolve-region dalam/luar pantauan.
- [ ] Test submit laporan + upload foto.
- [ ] Test antrean operator `menunggu/perlu_review`.
- [ ] Test validasi/tolak dan audit log.
- [ ] Test research download CSV/JSON.
- [ ] Test API key middleware.
- [ ] Test notification settings dan inbox.
- [ ] Test import data BIG/tidal/prediksi.
- [ ] Test scheduler command.

---

## B. Frontend checklist

### B1. Fondasi frontend production

- [x] Vite build sukses.
- [~] Build warning chunk besar masih ada.
- [ ] Code splitting untuk map/dashboard/research agar bundle tidak terlalu besar.
- [ ] `VITE_API_BASE_URL` production terdokumentasi.
- [ ] Error boundary global.
- [ ] Loading/skeleton state konsisten.
- [ ] Empty state konsisten.
- [ ] Toast error/success konsisten.
- [ ] Responsive smoke test mobile/tablet/desktop.
- [ ] Accessibility audit: keyboard, focus, contrast, aria.

### B2. Routing, auth, dan session

- [x] Login/register tersedia.
- [x] Redirect berdasarkan role tersedia.
- [~] Session expiry handler tersedia.
- [ ] Lupa kata sandi/reset password jika diwajibkan SKPL.
- [ ] Register role harus sinkron dengan backend; backend saat ini default warga.
- [ ] Hilangkan dev shortcuts dari production.
- [ ] Guard route per role di frontend.
- [ ] UI akun pending/nonaktif/ditolak harus jelas.

### B3. Landing page dan onboarding

- [x] Landing page tersedia dan sudah dipoles.
- [x] Judul produk sudah diganti.
- [x] Panduan “cara membaca peta” dan “cara melapor” tersedia.
- [~] Panduan warga login sudah disamakan sebagian dengan landing.
- [ ] FAQ lengkap sesuai PRD.
- [ ] Landing harus punya copy final, bukan mock/dummy.
- [ ] CTA “Mulai Lapor” harus login jika belum.
- [ ] Ilustrasi peta final harus konsisten dengan data peta publik.

### B4. Peta publik (`FR-PUB`)

- [x] Peta publik tersedia.
- [x] Filter kabupaten dan auto zoom tersedia.
- [~] Pin/zona ketika filter sudah pernah diperbaiki, perlu regression test.
- [ ] Toggle layer semua PRD: zona bahaya, laporan, infrastruktur kritis, evakuasi, pasang surut.
- [ ] Panel detail wilayah klik peta.
- [ ] Horizon prediksi hari ini, +1, +2, +3, +7.
- [ ] Banner peringatan BMKG aktif.
- [ ] Export data peta dari UI.
- [ ] Mobile map UX diuji.
- [ ] Legend dan warna konsisten dengan severity/risk class.

### B5. Mode Awam (`FR-AWAM`)

- [x] Mode awam tersedia dan sudah dipoles.
- [~] Perlu validasi mobile dan geolokasi browser.
- [ ] Manual lokasi dengan autocomplete/dropdown wilayah.
- [ ] Pesan “di luar pantauan” harus konsisten dengan backend.
- [ ] Prakiraan 7 hari tampil jelas.
- [ ] Laporan sekitar lokasi tampil dengan status validasi.
- [ ] Bahasa non-teknis final.

### B6. Form laporan ground truth (`FR-GT`)

- [x] Form lapor tersedia.
- [x] Pin lokasi dan reverse/resolve region tersedia.
- [x] Upload foto tersedia.
- [~] Checkbox deklarasi sudah diminta tidak default checklist.
- [ ] Severity UI harus mengikuti tinggi air otomatis agar tidak misleading.
- [ ] Preview foto dan validasi ukuran/jumlah.
- [ ] Progress submit dan retry error.
- [ ] Status setelah submit jelas: `menunggu` atau `perlu_review`.
- [ ] Riwayat harus menampilkan jam/lokasi sesuai laporan.
- [ ] Test lokasi seluruh Lampung.

### B7. Riwayat laporan warga

- [x] Riwayat laporan tersedia.
- [x] Pagination 15 laporan per halaman tersedia.
- [~] Detail riwayat sudah dipoles, perlu final QA.
- [ ] Badge status dan wilayah pantauan konsisten.
- [ ] Foto dokumentasi tampil aman.
- [ ] Empty state dan error state.

### B8. Dashboard operator BPBD

- [x] Dashboard operator tersedia.
- [x] Antrean laporan tersedia.
- [x] Validasi/tolak/detail tersedia.
- [x] KPI memakai summary backend.
- [~] Perlu QA untuk laporan `perlu_review`.
- [ ] Alert laporan baru harus realtime/polling.
- [ ] Filter wilayah kerja eksplisit.
- [ ] Export laporan operator dari UI.
- [ ] Status kelurahan harus data real dan lengkap.
- [ ] UX antrean untuk banyak laporan.

### B9. Dashboard provinsi BPBD

- [x] Dashboard provinsi tersedia.
- [x] Export CSV tombol aktif.
- [x] Top 10 risiko diurutkan.
- [~] Grafik tren tersedia, perlu definisi sesuai PRD.
- [ ] Filter periode bulan dan kabupaten.
- [ ] Sorting tabel risiko per kabupaten.
- [ ] Trend naik/turun/stabil divisualkan.
- [ ] Print/export ringkasan jika dibutuhkan SKPL.

### B10. Admin user management

- [x] List user tersedia.
- [x] Approve/reject tersedia.
- [x] Perizinan peneliti masuk admin.
- [x] Tombol kembali dari peninjauan perizinan tersedia.
- [x] Tambah user manual tersedia.
- [~] Edit role/wilayah/status backend tersedia; UX edit inline masih bisa dipoles.
- [x] Filter/search tersedia dan diuji backend.
- [ ] Pagination user harus rapi.
- [ ] Konfirmasi aksi destructive/nonaktif.

### B11. Audit log viewer

- [x] Halaman audit tersedia.
- [~] Filter/search tersedia sebagian.
- [x] Export audit log dari UI.
- [~] Detail payload audit aman via resource ringkas; tampilan detail payload readable masih bisa dipoles.
- [ ] Pagination, empty state, dan error state final.
- [ ] Warna outcome konsisten.

### B12. Portal peneliti dan arsip data

- [x] Arsip data tersedia.
- [x] Filter tahun/jenis/search aktif.
- [x] Pagination aktif.
- [x] Download CSV/JSON aktif via token login.
- [x] API key regenerate tersedia.
- [x] Referensi API tersedia.
- [~] Statistik download dataset tersedia.
- [ ] Tab “Penggunaan API” masih placeholder.
- [ ] Filter kabupaten perlu backend metadata.
- [ ] Tab lisensi/perizinan data terpisah.
- [ ] UX salin API key harus jelas: raw key hanya sekali tampil.
- [ ] Dokumentasi contoh response API.

### B13. Notifikasi

- [x] Bell/dropdown notifikasi tersedia.
- [x] Settings notifikasi tersedia.
- [~] Inbox notification tersedia.
- [ ] Browser push permission flow.
- [ ] Email/WA/SMS status dan fallback.
- [ ] Quiet hours UI harus cocok backend.
- [ ] Wilayah pantauan selector harus autocomplete/dropdown.
- [ ] Mark read/read all.

### B14. UI polish dan konsistensi

- [x] Scrollbar invisible sudah pernah diterapkan.
- [x] Navbar publik login/dashboard sudah disesuaikan.
- [~] Badge severity/risk class sudah dipetakan di beberapa halaman.
- [ ] Audit semua warna badge `sangat_tinggi`, `tinggi`, `sedang`, `rendah`.
- [ ] Audit semua teks mojibake/encoding.
- [ ] Audit semua tombol tanpa aksi.
- [ ] Audit copywriting Bahasa Indonesia final.
- [ ] Desain mobile semua role.

---

## C. Checklist pemenuhan PRD per FR

### FR-PUB — Portal Publik

- [~] FR-PUB-1 Peta interaktif 4 level risiko.
- [ ] FR-PUB-2 Horizon prediksi hari ini, +1, +2, +3, +7.
- [~] FR-PUB-3 Toggle layer; belum lengkap infrastruktur kritis/jalur evakuasi.
- [~] FR-PUB-4 Panel detail wilayah.
- [ ] FR-PUB-5 Banner peringatan BMKG aktif.
- [x] FR-PUB-6 Responsive desktop/mobile perlu QA final.
- [~] FR-PUB-7 Export data peta backend ada, UI perlu dipastikan.

### FR-AWAM — Mode Awam

- [~] FR-AWAM-1 Geolokasi/manual.
- [x] FR-AWAM-2 Status bahaya bahasa awam.
- [x] FR-AWAM-3 Probabilitas, tinggi pasang, waktu puncak.
- [x] FR-AWAM-4 Prakiraan 7 hari.
- [x] FR-AWAM-5 Laporan sekitar lokasi.

### FR-GT — Pelaporan

- [x] FR-GT-1 Alur 3 langkah.
- [x] FR-GT-2 Severity berbasis tinggi genangan di backend.
- [x] FR-GT-3 Koordinat, waktu, tinggi air.
- [x] FR-GT-4 Status menunggu + SLA 1x24; tersedia query overdue dan notifikasi berkala.

### FR-OPS — Dashboard Operator

- [~] FR-OPS-1 Filter wilayah kerja.
- [x] FR-OPS-2 Antrean dan aksi Validasi/Tolak/Detail.
- [~] FR-OPS-3 Alert laporan baru.
- [x] FR-OPS-4 Status bahaya per kelurahan.
- [x] FR-OPS-5 KPI operator.

### FR-PROV — Dashboard Provinsi

- [x] FR-PROV-1 Summary lintas kabupaten.
- [~] FR-PROV-2 Tabel risiko; sorting/tren perlu final.
- [~] FR-PROV-3 Grafik 30 hari; definisi perlu final.
- [~] FR-PROV-4 Filter periode/kabupaten dan export; export ada, filter belum lengkap.

### FR-ADM — Administrasi

- [x] FR-ADM-1 Tambah user + approval.
- [x] FR-ADM-2 Kelola role/instansi/wilayah/status.
- [~] FR-ADM-3 Audit aksi penting; admin user sudah fail-safe, beberapa aksi sistem lain masih perlu audit final.
- [x] FR-ADM-4 Audit filter/search/export.

### FR-PEN — Peneliti/API

- [x] FR-PEN-1 Lihat dan unduh dataset CSV/JSON.
- [x] FR-PEN-2 Metadata dataset.
- [x] FR-PEN-3 API key lihat/salin/regenerasi.
- [~] FR-PEN-4 Statistik pemakaian; API call harian belum akurat.
- [~] FR-PEN-5 Referensi API ada; lisensi/perizinan tab terpisah belum lengkap.

### FR-NOTIF — Notifikasi

- [~] FR-NOTIF-1 Pilih kanal; pengiriman multi-kanal production belum.
- [~] FR-NOTIF-2 Pilih event; event backend belum semua.
- [~] FR-NOTIF-3 Quiet hours; logic pengiriman perlu final.
- [~] FR-NOTIF-4 Wilayah pantauan; selector/filter perlu final.

### FR-OB — Onboarding

- [x] FR-OB-1 Panduan konsep/cara baca/cara lapor.
- [~] FR-OB-2 FAQ perlu dilengkapi sesuai PRD.

---

## D. Checklist SKPL dan dokumen serah-terima

- [ ] Ekstrak isi detail SKPL dari `docs/SKPL_SIPERAH_RoB.docx` ke Markdown agar mudah dilacak.
- [ ] Mapping setiap kebutuhan SKPL ke modul backend/frontend.
- [ ] Mapping setiap kebutuhan SKPL ke test case.
- [ ] Buat traceability matrix: Requirement → Endpoint/UI → Test → Status.
- [ ] Buat dokumen API final.
- [ ] Buat ERD/database final.
- [ ] Buat deployment guide.
- [ ] Buat user guide per role.
- [ ] Buat admin operation guide.
- [ ] Buat runbook incident: API down, DB down, import gagal, notifikasi gagal.

---

## E. Checklist CI/CD dan QA final

- [ ] CI backend: composer install, PHP lint, PHPUnit.
- [ ] CI frontend: npm ci, typecheck, build.
- [ ] Dependency audit Composer.
- [ ] Dependency audit npm.
- [ ] E2E smoke test: login semua role.
- [ ] E2E smoke test: peta publik.
- [ ] E2E smoke test: warga submit laporan.
- [ ] E2E smoke test: operator validasi/tolak.
- [ ] E2E smoke test: provinsi export.
- [ ] E2E smoke test: peneliti download dataset/API key.
- [ ] E2E smoke test: admin approve/reject user.
- [ ] Load test endpoint peta publik.
- [ ] Load test endpoint reports.
- [ ] Load test API key research.
- [ ] Backup restore drill.
- [ ] Observability: log, metrics, alert.

---

## F. Definition of Done production

Sistem dianggap siap production jika:

- [ ] Semua FR PRD berstatus `[x]` atau ada keputusan tertulis untuk defer.
- [ ] Semua kebutuhan SKPL sudah masuk traceability matrix.
- [ ] Semua endpoint utama punya test minimal happy path dan RBAC negative path.
- [ ] Semua tombol utama frontend punya aksi nyata atau sengaja disembunyikan.
- [ ] Tidak ada hardcoded localhost di source production.
- [ ] Tidak ada demo shortcut di build production.
- [ ] Data production bersumber resmi atau diberi label provenance jelas.
- [ ] Scheduler dan queue berjalan di server.
- [ ] Backup, restore, dan monitoring aktif.
- [ ] Security review selesai.
- [ ] UAT per role selesai: Warga, Operator BPBD, BPBD Provinsi, Peneliti, Admin.
- [ ] Deployment guide dan rollback plan tersedia.
