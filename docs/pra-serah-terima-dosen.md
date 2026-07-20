# Urutan Tugas Pra-Serah-Terima ke Dosen

> Disusun 2026-07-20 dari audit kode nyata + sisa item `checklist_daftar tugas.md`.
> Dikerjakan **berurutan blok A → E**. Tiap tugas diberi label kategori, prioritas,
> estimasi effort, dan alasan urutannya. Item yang sudah `[x]` di checklist besar
> tidak diulang; ini khusus "yang tersisa sebelum dinilai dosen".

Legenda kategori: 🔒 keamanan · 🐞 bug/perf · 🧹 dead code · ✨ polish UI · 📄 dokumen · ✅ verifikasi

---

## BLOK A — Kebersihan wajib sebelum dilihat siapa pun (cepat, risiko rendah)

Kerjakan dulu: murah, tidak memblokir apa pun, dan langsung menghilangkan hal yang
memalukan/berisiko saat demo di depan dosen.

- [ ] **A1 · 🔒 polish · ~15 mnt** — Hapus **DEV SHORTCUTS** di `frontend/src/features/auth/LoginPage.tsx:298-309`.
  - Alasan: 6 tombol quick-login membocorkan kredensial akun demo (`warga@`, `operator@`, `admin@` … / `password`) dan tampil di situs **live publik**. Ini item checklist 3.1 yang masih `[ ]` ("hapus sebelum UAT eksternal"). Serah-terima ke dosen = pemirsa eksternal.
  - Selesai bila: blok tombol hilang dari build; login manual 5 role masih jalan; E2E `login.spec` tetap hijau.
- [x] **A2 · 🧹 · ~10 mnt** — Hapus dead code `frontend/src/shared/api/weatherClient.ts` (file utuh). ✅ 2026-07-20
  - Alasan: tidak di-import di mana pun (`getMLPrediction`/`getLampungMarineData` nol pemakai). `getMLPrediction()` mengembalikan array **simulasi hardcoded** — bom waktu bila suatu saat dipakai lagi & menampilkan angka palsu.
  - Selesai bila: file dihapus; `tsc -b` + `vite build` hijau (bukti benar-benar tak terpakai). **Terbukti**: grep konfirmasi nol referensi eksternal; `npm run build` hijau (built 3.08s) tanpa file itu.
- [ ] **A3 · 🧹 · ~10 mnt** — Hapus dependency mati `gsap` + `@gsap/react` dari `frontend/package.json:16-18`.
  - Alasan: nol import di `src` (pola sama seperti `echarts` yang sudah dibersihkan). Mengurangi `node_modules` & permukaan audit.
  - Selesai bila: `npm remove gsap @gsap/react` → `npm ci` bersih → `tsc`+`build`+E2E hijau; commit lockfile regenerasi (ingat pelajaran lockfile Rolldown/Vite 8 — regenerasi, jangan inkremental).
- [ ] **A4 · ✨ · ~10 mnt** — Perbaiki/hapus checkbox "Ingat saya" non-fungsional di `LoginPage.tsx:283-286`.
  - Alasan: kontrol tanpa `checked`/`onChange` = kontrol palsu. Pilihan jujur: (a) hilangkan, atau (b) sambungkan ke perilaku token nyata. Untuk serah-terima, opsi (a) paling cepat & jujur.

---

## BLOK B — Bug yang sudah diperbaiki di kode tapi belum sampai ke server

- [ ] **B1 · 🐞 perf · ~30 mnt (butuh tethering)** — Deploy fix N+1 `is_within_monitoring_area` ke production.
  - Alasan: fix sudah di-commit & push ke GitHub, tapi **belum di-deploy ke Hostinger** (checklist Tahap 7 baris ini eksplisit "Belum di-deploy ke production"). Kalau dosen membuka `/api/reports` di server nyata, masih kena versi lambat (~870 ms/baris).
  - Langkah: `bash scripts/deploy-hostinger.sh` + `php artisan migrate --force` (migrasi `2026_07_20_..._add_is_within_monitoring_area`) + `config:cache`. Ingat firewall Hostinger → butuh tethering.
  - Selesai bila: `GET /api/reports` di production < ~0,5 dtk & kolom `is_within_monitoring_area` terisi untuk baris lama (backfill migrasi).

---

## BLOK C — Fitur P1/P2 terbuka: kerjakan **atau** tulis keputusan defer resmi

DoD sistem menuntut Tahap 4 minimal P1. Untuk konteks TA/serah-terima, tiap item di
sini boleh **di-defer secara TERTULIS** (seperti item lain di checklist) asalkan
alasannya jelas — dosen menilai kelengkapan + kejujuran keputusan, bukan wajib semua "on".

- [ ] **C1 · 🔧 P1 (keputusan)** — Email production SMTP + template per event (Tahap 4, masih `[ ]`).
  - Opsi: (a) konfigurasi SMTP nyata (mis. Gmail app-password/Mailtrap) + uji 1 email; atau (b) **defer tertulis**: `MAIL_MAILER=log`, catat di laporan bahwa kanal email siap-sambung tapi belum diaktifkan (provider belum ada). Rekomendasi: (b) + demokan template lewat log/inbox.
- [ ] **C2 · 🔧 P2 (keputusan)** — WhatsApp production (Tahap 4, `[ ]`).
  - Hampir pasti **defer tertulis** (WA Business API berbayar/verifikasi). Catat sebagai "di luar lingkup TA, mock aktif".
- [ ] **C3 · 📄 P3 (keputusan)** — Hapus dev-shortcut & pastikan tak ada jalur debug lain di build production — sebagian sudah tercakup A1; tandai item checklist 3.1 `[x]` setelah A1 tuntas.

> Item `[~]` yang **sudah diputuskan defer** (Layer infrastruktur/evakuasi → tunggu data BPBD; Populasi BPS; Evaluasi akurasi model → tunggu ground truth) **tidak perlu dikerjakan** — cukup pastikan alasan defer-nya masuk ke laporan/SKPL sebagai batasan sistem.

---

## BLOK D — Dokumentasi (INI yang paling dinilai dosen) — Tahap 8, semua terbuka

Blok terbesar & paling menentukan nilai. Urut dari yang paling sering diminta penguji.

- [ ] **D1 · 📄 P1** — Tulis ulang **Deployment Guide** (`docs/deployment_guide.md`).
  - Alasan: dokumen lama masih menggambarkan arsitektur **VPS + Redis + Nginx yang TIDAK jadi dipakai** — menyesatkan penguji. Ganti ke arsitektur nyata: Hostinger shared + Supabase + GitHub Actions (`scripts/deploy-hostinger.sh`, `docs/backup-database.md`). Sertakan rollback plan.
- [ ] **D2 · 📄 P1** — Ekstrak **SKPL** (`docs/SKPL_SIPERAH_RoB.docx`) → Markdown + **traceability matrix**: Requirement → Endpoint/UI → Test → Status.
  - Alasan: hampir selalu wajib untuk TA rekayasa perangkat lunak; membuktikan setiap requirement terimplementasi & teruji. Ini yang paling sering ditanya saat sidang.
- [ ] **D3 · 📄 P2** — Dokumen **API final** (rapikan `docs/api-contract.md` + referensi peneliti jadi dokumen utuh).
- [ ] **D4 · 📄 P2** — **ERD/skema DB final** (update `database/schema.sql` + diagram).
- [ ] **D5 · 📄 P2** — **User guide per role** (Warga, Operator, Provinsi, Peneliti, Admin) — screenshot alur inti.
- [ ] **D6 · 📄 P2** — **Admin runbook + incident** (API down, DB down, import gagal, notifikasi gagal). Sebagian bahan sudah ada di memori proyek & `docs/backup-database.md`.
- [ ] **D7 · 📄 P2** — **UAT per role** dijalankan & hasilnya dicatat (skenario, ekspektasi, aktual, lolos/tidak).
- [ ] **D8 · 📄 P3** — Review **copywriting** final menyeluruh oleh manusia.

---

## BLOK E — Verifikasi akhir sebelum submit

- [ ] **E1 · ✅** — `vendor\bin\phpunit` full suite hijau (DB `siperah_rob_test`; jalankan `composer test:prepare` bila ada migrasi baru dari B1).
- [ ] **E2 · ✅** — `npm run e2e` (Playwright) hijau — pastikan A1 tak merusak `login.spec`.
- [ ] **E3 · ✅** — `npm run build` + `tsc -b` bersih; cek bundle tak membawa `gsap`/`weatherClient` lagi.
- [ ] **E4 · ✅** — CI GitHub (backend + frontend) hijau di commit terakhir.
- [ ] **E5 · ✅** — Smoke test manual di **production** per role (login → aksi inti) setelah deploy B1.

---

## Ringkasan urutan singkat

1. **A (bersih-bersih, ~45 mnt total)** → hilangkan dev shortcut, dead code, dead deps, checkbox palsu.
2. **B (~30 mnt)** → deploy fix perf N+1 ke server.
3. **C (keputusan)** → email/WA: aktifkan atau defer tertulis.
4. **D (bobot terbesar)** → dokumentasi Tahap 8, dahulukan D1 & D2.
5. **E** → verifikasi test/build/CI/smoke sebelum menyerahkan.

Jalur kritis nilai dosen = **D2 (SKPL + traceability)** dan **D1 (deployment guide)**;
jalur "jangan sampai memalukan saat demo" = **A1 (dev shortcut)** dan **B1 (deploy fix)**.
