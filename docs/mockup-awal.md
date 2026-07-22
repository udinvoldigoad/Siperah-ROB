# Mockup Awal Dosen

Sumber lokal:

```txt
C:\Users\ASUS\Downloads\laporan\SIG Penelitian 2026
```

Catatan: semua HTML mereferensikan `_app.css` dan sebagian `_nav.js`, tetapi dua file itu tidak ada di folder. Pakai mockup ini sebagai referensi struktur, konten, dan alur, bukan sebagai source CSS final.

## Pemetaan Layar

| File | Modul |
|---|---|
| `index.html` | Portal sistem terpadu |
| `mockup_1_peta_publik_desktop.html` | Peta bahaya rob desktop |
| `mockup_2_dashboard_bpbd_provinsi.html` | Dashboard BPBD provinsi |
| `mockup_3_mode_awam_mobile.html` | Mode awam mobile |
| `mockup_4_form_laporan_ground_truth.html` | Form laporan langkah 1-2 |
| `mockup_5_peta_publik_mobile.html` | Peta komunitas mobile |
| `mockup_6_dashboard_bpbd_operator.html` | Dashboard operator BPBD |
| `mockup_7_login_register.html` | Login dan register |
| `mockup_8_ground_truth_step3.html` | Form laporan langkah 3 |
| `mockup_9_onboarding_mode_awam.html` | Panduan pengguna dan FAQ |
| `mockup_10_notification_settings.html` | Pengaturan notifikasi |
| `mockup_11_admin_user_management.html` | Manajemen pengguna |
| `mockup_12_researcher_archive_api.html` | Arsip data dan API peneliti |
| `mockup_13_audit_log_viewer.html` | Audit log |

## Detail Yang Harus Dipertahankan

- Risiko 4 kelas: rendah, sedang, tinggi, sangat tinggi.
- Peta publik: horizon hari ini, +1, +3, +7, layer laporan ground truth, infrastruktur, jalur evakuasi, pasang surut BMKG.
- Peringatan BMKG: pasang puncak 21-23 Mei 2026, perigee + bulan baru, 4 kabupaten sangat tinggi.
- Popup wilayah: kelas bahaya, probabilitas, populasi risiko, tombol lapor kejadian.
- Model: Random Forest v1.2.0, akurasi 87%, precision 0.89, recall 0.85, data BMKG + BIG + BPS + laporan ground truth.
- Dashboard provinsi: kabupaten pantau aktif, kelurahan bahaya tinggi+, populasi risiko, laporan tervalidasi, tren 30 hari, tabel kabupaten.
- Dashboard operator: KPI kelurahan pantau, bahaya sangat tinggi, laporan menunggu, validasi bulan ini, antrean validasi, aksi validasi/tolak, status kelurahan.
- Mode awam: status bahaya personal, probabilitas, pasang maksimum, waktu puncak, prakiraan 7 hari, laporan warga sekitar.
- Ground truth: 3 langkah, lokasi peta, keparahan, deskripsi, foto dan kirim, verifikasi BPBD dalam 1x24 jam.
- Notifikasi: push browser, email, WhatsApp, SMS khusus operator, event bahaya sangat tinggi, laporan baru, update model, ringkasan harian, BMKG pasang ekstrem, jam sunyi.
- Admin: filter role, status, wilayah, approval akun, status aktif/nonaktif/menunggu.
- Peneliti: dataset CSV/JSON, metadata periode/resolusi/rekaman/lisensi, referensi API, penggunaan API.
- Audit: action, actor, target, timestamp, outcome success/fail/denied/partial, payload detail.

## Implikasi Untuk Implementasi

- Frontend React harus punya semua route di atas, bukan hanya dashboard utama.
- Backend API yang sudah discaffold tetap cocok dengan mockup awal.
- `.desain-awal/` tetap dipakai untuk visual direction yang lebih bersih; mockup dosen dipakai untuk coverage fitur dan konten.
