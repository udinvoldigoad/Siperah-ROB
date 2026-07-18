# Prosedur Rotasi Secret — SIPERAH-RoB

> Terakhir diperbarui: 2026-07-18. Konteks: repo **publik**, production di
> Hostinger shared hosting (`~/apps/siperah-backend/.env`), DB di Supabase,
> pipeline ML di GitHub Actions. Tidak ada VPS/secret manager — secret hidup
> di tiga tempat: `.env` server, GitHub Actions Secrets, dan dashboard Supabase.

## Inventaris secret

| Secret | Lokasi | Dipakai oleh | Dampak bila bocor |
|---|---|---|---|
| `APP_KEY` | `.env` server | Enkripsi Laravel (cookie, signed URL foto) | Pemalsuan signed URL foto & cookie |
| Password DB Supabase | `.env` server + GitHub Secrets `SUPABASE_DB_*` | Laravel + workflow ML | Akses penuh database |
| Token Sanctum (login user) | tabel `personal_access_tokens` (hash) | Sesi login semua user | Pembajakan akun individual |
| API key peneliti | tabel `api_keys` (hash) | API `/api/v1/*` | Akses data riset atas nama peneliti |
| VAPID key (WebPush) | `.env` server (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`) | Notifikasi push browser | Pengiriman push palsu ke subscriber |
| SSH key deploy (`id_ed25519` mesin ASUS) | mesin lokal + authorized_keys Hostinger | Deploy manual via tethering | Akses shell hosting |
| Kredensial email/WA/SMS | **belum ada** (mail = log, WA/SMS = mock) | — | Isi bagian ini saat provider asli dipasang |

## Prosedur per secret

### 1. `APP_KEY`
1. SSH ke Hostinger (wajib tethering HP — firewall memblokir IP rumah).
2. `cd ~/apps/siperah-backend && /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan key:generate --force`
3. `... artisan config:cache`
4. **Efek samping**: semua signed URL foto yang beredar hangus (maks. 12 jam,
   terbit ulang otomatis), sesi cookie lama tak terbaca. Token Sanctum TIDAK
   terpengaruh (disimpan sebagai hash SHA-256, bukan enkripsi).

### 2. Password DB Supabase
> ⚠️ Password pernah terpapar di percakapan 2026-07-16 — **rotasi ini wajib
> dilakukan** bila belum.
1. Supabase Dashboard → Project Settings → Database → Reset database password.
2. Perbarui `.env` server (`DB_PASSWORD`) → `artisan config:cache`.
3. Perbarui GitHub repo → Settings → Secrets and variables → Actions →
   `SUPABASE_DB_PASSWORD` (cek nama persis di `.github/workflows/ml-predict*.yml`).
4. Uji: `artisan migrate:status` di server + jalankan workflow ML via
   `workflow_dispatch`, pastikan prediksi harian tetap masuk.
5. Urutan penting: reset dulu, langsung update kedua konsumen — di antara
   langkah 1–3 aplikasi & pipeline gagal konek (downtime singkat, pilih jam
   sepi, hindari jam cron 06:00 WIB).

### 3. Token Sanctum (semua sesi login)
- Rotasi massal (mis. setelah insiden): `TRUNCATE personal_access_tokens;`
  via SQL editor Supabase — semua user dipaksa login ulang. Tanpa efek lain.
- Per user: hapus baris `tokenable_id = <user_id>`.

### 4. API key peneliti
- Peneliti bisa regenerasi sendiri di portal riset (`POST /research/api-keys`)
  — key lama langsung hangus (hash diganti).
- Paksa dari sisi admin: hapus/nonaktifkan baris di tabel `api_keys`;
  peneliti membuat ulang dari portal.

### 5. VAPID key (WebPush)
1. Generate pasangan baru: `npx web-push generate-vapid-keys` (atau
   `openssl ecparam -genkey -name prime256v1`).
2. Ganti `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` di `.env` server →
   `artisan config:cache`.
3. **Efek samping**: seluruh subscription lama tak valid (push gagal terkirim).
   Kosongkan tabel `push_subscriptions`; browser user akan subscribe ulang
   saat membuka aplikasi (public key baru diambil dari
   `/api/webpush/vapid-public-key`).

### 6. SSH key deploy
1. Buat key baru di mesin lokal: `ssh-keygen -t ed25519`.
2. Tambahkan public key baru di hPanel → SSH Access, hapus yang lama.
3. Uji `ssh -p 65002 u234110555@145.223.108.38` (via tethering) sebelum
   menghapus key lama dari mesin.

## Kapan rotasi

| Pemicu | Tindakan |
|---|---|
| Secret terpapar (chat, commit, log) | Rotasi **saat itu juga**; untuk commit di repo publik anggap bocor permanen — rotasi, jangan cuma hapus commit |
| Anggota tim/peneliti keluar | Cabut API key & token Sanctum miliknya |
| Rutin | Password DB & `APP_KEY` tiap 6 bulan; SSH key tiap 12 bulan |
| Indikasi akses aneh di audit log | Rotasi DB + truncate token, baru investigasi |

## Aturan tetap

- Repo publik: secret **tidak pernah** masuk git — `.env` di-gitignore,
  contoh konfigurasi hanya di `.env.example` dengan nilai kosong.
- Setelah tiap perubahan `.env` di server wajib `artisan config:cache`
  (config di-cache; nilai baru tidak terbaca tanpa itu).
- Simpan salinan nilai aktif hanya di password manager pribadi, bukan di
  dokumen/chat.
