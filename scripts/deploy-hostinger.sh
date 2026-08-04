#!/usr/bin/env bash
# Deploy SAIBAR ke Hostinger shared hosting.
# Jalankan dari root repo: bash scripts/deploy-hostinger.sh
#
# Konfigurasi dibaca dari scripts/deploy.env (TIDAK ikut Git â€” repo ini public).
# Salin scripts/deploy.env.example menjadi scripts/deploy.env lalu isi nilainya.
# Prasyarat: SSH key terdaftar di hPanel, dan jaringan yang tidak diblokir
# firewall Hostinger (tethering HP bila IP rumah masih ditandai berisiko).

set -euo pipefail

CONF="$(dirname "$0")/deploy.env"
[ -f "$CONF" ] || { echo "scripts/deploy.env tidak ditemukan. Salin dari deploy.env.example."; exit 1; }
# shellcheck source=deploy.env.example
source "$CONF"
: "${SSH_HOST:?isi SSH_HOST di deploy.env}" "${SSH_PORT:?}" "${REMOTE_APP:?}" "${SITE_URL:?}"

PHP84="/opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql"

echo "==> 1/4 Build frontend"
(cd frontend && npm run build)

echo "==> 2/4 Tarik kode terbaru di server (git pull)"
ssh -p "$SSH_PORT" "$SSH_HOST" "cd $REMOTE_APP && git pull --ff-only"

echo "==> 3/4 Upload frontend build"
tar -C frontend/dist -czf - . | ssh -p "$SSH_PORT" "$SSH_HOST" "cd $REMOTE_APP/backend/public && tar xzf -"

# Penjaga: unggahan dari Windows pernah membuat entri bernama HARFIAH
# "public\assets" & "public\index.html" (backslash jadi bagian nama berkas,
# bukan pemisah folder) di dalam backend/. Apache tak pernah menyajikannya,
# jadi kesalahannya tak terlihat â€” 2,5 MB aset basi baru ketahuan berbulan
# kemudian lewat `git status`. Gagalkan deploy segera bila terulang.
# grep -F (pencocokan literal) dipakai supaya backslash tak perlu di-escape
# lagi setelah menembus bash lokal -> ssh -> shell remote.
STRAY=$(ssh -p "$SSH_PORT" "$SSH_HOST" "ls -1 $REMOTE_APP/backend | grep -F '\\' || true")
if [ -n "$STRAY" ]; then
  echo "FATAL: ada entri bernama backslash di backend/ â€” unggahan memakai path Windows:"
  echo "$STRAY"
  exit 1
fi

echo "==> 4/4 Composer + optimasi Laravel"
ssh -p "$SSH_PORT" "$SSH_HOST" "cd $REMOTE_APP/backend \
  && mkdir -p bootstrap/cache resources/views \
  && $PHP84 \$(which composer) install --no-dev --optimize-autoloader --no-interaction -q \
  && { grep -q DirectoryIndex public/.htaccess || sed -i '1i DirectoryIndex index.html index.php' public/.htaccess; } \
  && grep -q '^DB_CONNECTION=pgsql' .env || { echo 'FATAL: DB_CONNECTION=pgsql tidak ada di .env server â€” artisan optimize akan membekukan fallback sqlite!'; exit 1; } \
  && $PHP84 artisan optimize \
  && $PHP84 artisan migrate:status --no-ansi | head -n 3"
# migrate:status di akhir = smoke test koneksi DB dengan config yang SUDAH
# di-cache; kalau cache terlanjur sqlite, deploy gagal keras di sini alih-alih
# produksi error 'no such table' diam-diam.

echo "==> Selesai. Smoke test:"
curl -s -o /dev/null -w "  frontend: %{http_code}\n" "$SITE_URL/"
curl -s -o /dev/null -w "  API     : %{http_code}\n" "$SITE_URL/api/public/mode-awam?lat=-5.45&lon=105.26"

