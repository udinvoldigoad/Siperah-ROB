# Matriks Ketertelusuran Kebutuhan (Requirements Traceability Matrix - SKPL)

Dokumen ini memetakan seluruh Kebutuhan Fungsional (FR) dari dokumen spesifikasi SKPL/PRD ke komponen antarmuka (UI), endpoint backend, serta pengujian otomatis (*automated tests*) yang menjamin pemenuhan kebutuhan tersebut.

---

## 1. Portal Publik - Peta & Informasi Risiko (`FR-PUB`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-PUB-1** | Menampilkan peta interaktif dengan 4 tingkat risiko rob per kelurahan. | `PublicMapPage.tsx`<br>`GET /api/public/map` | `PublicMapTest.php`<br>`map.spec.ts` | `[x] Lolos` |
| **FR-PUB-2** | Pengguna dapat memilih horizon prediksi: hari ini, +1, +2, +3, +7 hari. | `PublicMapPage.tsx` (Sidebar/Header)<br>`GET /api/public/map` | `PublicMapTest.php`<br>`map.spec.ts` | `[x] Lolos` |
| **FR-PUB-3** | Peta mendukung toggle layer (zona bahaya, ground truth, dll). | `PublicMapPage.tsx` (Layer Control) | `map.spec.ts` | `[x] Lolos` |
| **FR-PUB-4** | Menampilkan panel detail per wilayah saat wilayah diklik. | `PublicMapPage.tsx` (Region Detail Panel) | `map.spec.ts` | `[x] Lolos` |
| **FR-PUB-5** | Menampilkan banner peringatan aktif dari BMKG saat kondisi ekstrem. | `PublicMapPage.tsx`<br>`GET /api/public/onboarding` | `PublicMapTest.php` | `[x] Lolos` |
| **FR-PUB-6** | Tersedia versi mobile-responsive untuk peta publik. | `PublicMapPage.tsx` (CSS Layout) | `map.spec.ts` (Mobile Viewport) | `[x] Lolos` |
| **FR-PUB-7** | Pengguna publik dapat mengekspor data peta. | `GET /api/public/map/export` | `PublicMapTest.php` | `[x] Lolos` |

---

## 2. Mode Awam - Status Bahaya Personal (`FR-AWAM`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-AWAM-1** | Mendeteksi lokasi pengguna otomatis (geolokasi) atau input koordinat manual. | `ModeAwamTab.tsx`<br>`GET /api/public/resolve-region` | `ResolveRegionTest.php`<br>`map.spec.ts` | `[x] Lolos` |
| **FR-AWAM-2** | Menampilkan status bahaya lokasi pengguna dengan bahasa non-teknis. | `ModeAwamTab.tsx`<br>`GET /api/public/mode-awam` | `PublicMapTest.php` | `[x] Lolos` |
| **FR-AWAM-3** | Menampilkan probabilitas, tinggi pasang maksimum, dan waktu puncak prediksi. | `ModeAwamTab.tsx`<br>`GET /api/public/mode-awam` | `PublicMapTest.php` | `[x] Lolos` |
| **FR-AWAM-4** | Menampilkan prakiraan pasang 7 hari ke depan. | `ModeAwamTab.tsx` (Tabel/Chart Mingguan)<br>`GET /api/public/mode-awam` | `PublicMapTest.php` | `[x] Lolos` |
| **FR-AWAM-5** | Menampilkan laporan warga di sekitar lokasi beserta status validasinya. | `ModeAwamTab.tsx` (Nearby Reports)<br>`GET /api/public/mode-awam` | `PublicMapTest.php` | `[x] Lolos` |

---

## 3. Pelaporan Ground Truth (`FR-GT`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-GT-1** | Form pelaporan 3 langkah: Pilih lokasi, isi deskripsi/keparahan, unggah foto. | `ReportSubmissionWizard.tsx`<br>`POST /api/reports` | `ReportSubmissionTest.php`<br>`report-flow.spec.ts` | `[x] Lolos` |
| **FR-GT-2** | Klasifikasi keparahan berbasis tinggi air: Ringan, Sedang, Parah, Sangat Parah. | `ReportSubmissionWizard.tsx` (Auto-calculate)<br>`POST /api/reports` | `ReportSubmissionTest.php`<br>`report-flow.spec.ts` | `[x] Lolos` |
| **FR-GT-3** | Sistem mencatat koordinat lokasi, waktu kejadian, dan foto laporan. | `POST /api/reports`<br>`GET /api/reports/photo/{photo}` | `ReportSubmissionTest.php`<br>`report-flow.spec.ts` | `[x] Lolos` |
| **FR-GT-4** | Laporan berstatus "menunggu" hingga diverifikasi operator BPBD. | `OperatorDashboardPage.tsx` (Queue)<br>`POST /api/reports` | `OperatorQueueTest.php`<br>`report-flow.spec.ts` | `[x] Lolos` |

---

## 4. Dashboard BPBD - Operator (`FR-OPS`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-OPS-1** | Operator dapat memfilter tampilan berdasarkan wilayah kerjanya. | `OperatorDashboardPage.tsx`<br>`GET /api/dashboard/operator/summary` | `OperatorQueueTest.php` | `[x] Lolos` |
| **FR-OPS-2** | Menampilkan antrean laporan masuk untuk Validasi, Tolak, atau detail. | `OperatorDashboardPage.tsx` (Queue)<br>`POST /api/reports/{id}/validate`<br>`POST /api/reports/{id}/reject` | `OperatorQueueTest.php`<br>`report-flow.spec.ts` | `[x] Lolos` |
| **FR-OPS-3** | Menampilkan alert saat ada laporan baru yang butuh verifikasi (realtime/polling). | `OperatorDashboardPage.tsx` (Polling Alert) | `dashboard.spec.ts` | `[x] Lolos` |
| **FR-OPS-4** | Menampilkan status bahaya per kelurahan di wilayah operator. | `OperatorDashboardPage.tsx` (Status Kelurahan)<br>`GET /api/dashboard/operator/summary` | `OperatorQueueTest.php` | `[x] Lolos` |
| **FR-OPS-5** | Menampilkan ringkasan KPI (laporan aktif, menunggu, tervalidasi). | `OperatorDashboardPage.tsx` (KPI Cards)<br>`GET /api/dashboard/operator/summary` | `OperatorQueueTest.php` | `[x] Lolos` |

---

## 5. Dashboard BPBD - Provinsi (`FR-PROV`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-PROV-1** | Menampilkan ringkasan lintas kabupaten (total bahaya, tervalidasi). | `ProvinceDashboardPage.tsx`<br>`GET /api/dashboard/province/summary` | `ProvinceDashboardTest.php`<br>`province.spec.ts` | `[x] Lolos` |
| **FR-PROV-2** | Tabel risiko per kabupaten yang dapat diurutkan berdasarkan parameter. | `ProvinceDashboardPage.tsx` (Sorted Table) | `province.spec.ts` | `[x] Lolos` |
| **FR-PROV-3** | Grafik tren prediksi 30 hari ke depan (kelurahan bahaya sangat tinggi). | `ProvinceDashboardPage.tsx` (Trend Chart) | `province.spec.ts` | `[x] Lolos` |
| **FR-PROV-4** | Menyediakan filter periode, filter kabupaten, dan ekspor data ke CSV. | `ProvinceDashboardPage.tsx`<br>`GET /api/dashboard/province/export` | `ProvinceDashboardTest.php`<br>`province.spec.ts` | `[x] Lolos` |

---

## 6. Administrasi Sistem (`FR-ADM`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-ADM-1** | Admin dapat meninjau, menyetujui, atau menolak akun operator/peneliti baru. | `AdminUsersPage.tsx`<br>`POST /api/admin/users/{id}/approve`<br>`POST /api/admin/users/{id}/reject` | `AuthFlowTest.php`<br>`admin.spec.ts` | `[x] Lolos` |
| **FR-ADM-2** | Admin dapat mengelola role, wilayah, dan status aktif/nonaktif user secara inline. | `AdminUsersPage.tsx` (Inline Editor)<br>`PATCH /api/admin/users/{id}` | `AuthFlowTest.php`<br>`admin.spec.ts` | `[x] Lolos` |
| **FR-ADM-3** | Sistem mencatat audit log otomatis untuk aksi penting (login, validasi, ekspor, dll). | `GET /api/admin/audit-logs` | `AuthFlowTest.php`<br>`OperatorQueueTest.php` | `[x] Lolos` |
| **FR-ADM-4** | Audit log dapat difilter berdasarkan jenis aksi dan outcome, dicari, serta diekspor. | `AdminAuditLogsPage.tsx` (Filters) | `admin.spec.ts` | `[x] Lolos` |

---

## 7. Portal Peneliti & API (`FR-PEN`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-PEN-1** | Peneliti dapat mengunduh dataset prediksi harian, ground truth, dan pasang surut. | `ResearchPortalPage.tsx`<br>`GET /api/research/datasets/{id}/download` | `ResearchDownloadTest.php`<br>`research.spec.ts` | `[x] Lolos` |
| **FR-PEN-2** | Setiap dataset menampilkan metadata (cakupan, jumlah baris, lisensi, dll). | `ResearchPortalPage.tsx` (Metadata Cards) | `ResearchDownloadTest.php` | `[x] Lolos` |
| **FR-PEN-3** | Sistem menyediakan manajemen API key (lihat, salin, regenerasi). | `ResearchPortalPage.tsx`<br>`POST /api/research/api-keys` | `ResearchDownloadTest.php`<br>`research.spec.ts` | `[x] Lolos` |
| **FR-PEN-4** | Menampilkan statistik pemakaian data bulanan dan panggilan API. | `ResearchPortalPage.tsx` (Usage Chart)<br>`GET /api/research/usage` | `ResearchDownloadTest.php` | `[x] Lolos` |
| **FR-PEN-5** | Dokumentasi API v1 publik lengkap dengan perizinan dan lisensi. | `ResearchPortalPage.tsx` (API Reference Tab)<br>`GET /api/research/api-reference` | `ResearchDownloadTest.php` | `[x] Lolos` |

---

## 8. Notifikasi Multi-Kanal (`FR-NOTIF`)

| Kode FR | Deskripsi Kebutuhan | Komponen UI / Endpoint | Berkas Uji / Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-NOTIF-1** | Berlangganan via push browser, email, dan WhatsApp. | `NotificationSettingsPage.tsx`<br>`POST /api/webpush/subscribe` | `NotificationApiTest.php` | `[x] Lolos` |
| **FR-NOTIF-2** | Pengguna dapat berlangganan jenis event (laporan baru, warning sangat tinggi, dll). | `NotificationSettingsPage.tsx`<br>`PUT /api/notifications/settings` | `NotificationApiTest.php` | `[x] Lolos` |
| **FR-NOTIF-3** | Mengatur "jam sunyi" (quiet hours) untuk menunda notifikasi non-kritis. | `NotificationSettingsPage.tsx`<br>`PUT /api/notifications/settings` | `NotificationApiTest.php`<br>`NotificationBehaviorTest.php` | `[x] Lolos` |
| **FR-NOTIF-4** | Memilih wilayah pantauan spesifik (kelurahan/kecamatan) untuk penyaringan notifikasi. | `NotificationSettingsPage.tsx` (Wilayah Autocomplete) | `NotificationApiTest.php` | `[x] Lolos` |
