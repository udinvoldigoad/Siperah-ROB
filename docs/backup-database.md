# Backup Database Production

Supabase free tier tidak menyediakan backup otomatis, dan Hostinger tidak punya
`pg_dump`. Backup dijalankan dari **repo GitHub private terpisah** — artifact di
repo private hanya bisa diakses pemilik/kolaborator, sehingga dump berisi data
warga tidak pernah menyentuh repo public ini.

## Setup sekali (±5 menit)

1. Buat repo **private** baru, mis. `siperah-backups` (cukup kosong).
2. Di repo itu: **Settings → Secrets and variables → Actions**, tambahkan
   secret yang sama dengan repo utama: `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`,
   `SUPABASE_DB_DATABASE`, `SUPABASE_DB_USERNAME`, `SUPABASE_DB_PASSWORD`.
3. Buat file `.github/workflows/db-backup.yml` di repo private itu dengan isi
   persis di bawah, lalu commit.
4. Uji: tab **Actions → Backup Database Mingguan → Run workflow**. Hasilnya
   muncul sebagai artifact `db-backup-...` (retensi 90 hari).

```yaml
name: Backup Database Mingguan

on:
  schedule:
    # 20:00 UTC Minggu = 03:00 WIB Senin
    - cron: "0 20 * * 0"
  workflow_dispatch: {}

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Install postgresql-client-17
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq postgresql-common
          yes | sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
          sudo apt-get install -y -qq postgresql-client-17

      - name: Dump database
        env:
          PGPASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          pg_dump \
            -h "${{ secrets.SUPABASE_DB_HOST }}" \
            -p "${{ secrets.SUPABASE_DB_PORT }}" \
            -U "${{ secrets.SUPABASE_DB_USERNAME }}" \
            -d "${{ secrets.SUPABASE_DB_DATABASE }}" \
            --no-owner --no-privileges -F c \
            -f "siperah-$(date -u +%F).dump"
          ls -lh siperah-*.dump

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: "*.dump"
          retention-days: 90
```

## Cara restore

1. Unduh artifact dari tab Actions repo private → run backup → Artifacts.
2. Ekstrak zip, lalu:
   ```
   pg_restore -h <host> -p 5432 -U <user> -d <db> --no-owner --no-privileges --clean --if-exists siperah-YYYY-MM-DD.dump
   ```

## Catatan

- `pg_dump` versi 17 wajib (server Supabase Postgres 17); klien bawaan runner
  (16) menolak dump.
- Kalau password database diganti, perbarui secret di **kedua** repo
  (utama untuk prediksi ML, private untuk backup).
- Foto laporan warga tersimpan di Hostinger (`storage/app/public`), bukan di
  database — backup terpisah bila diperlukan (mis. unduh berkala via SFTP).
