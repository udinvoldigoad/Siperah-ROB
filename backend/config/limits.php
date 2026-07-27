<?php

/*
|--------------------------------------------------------------------------
| Batas laju & retensi
|--------------------------------------------------------------------------
| Nilai dibaca via config() (bukan env() di runtime) agar tetap benar saat
| config:cache aktif di produksi. Untuk mengubah: sunting .env server lalu
| jalankan `php artisan config:cache` (tak perlu deploy kode ulang).
*/

return [
    // Endpoint publik (read) per menit. Longgar karena response ter-cache &
    // banyak warga pesisir berbagi IP di balik NAT ISP.
    'public_per_minute' => (int) env('PUBLIC_RATE_LIMIT', 180),

    // Export peta (stream CSV, lebih berat) — batas lebih ketat & terpisah.
    'public_export_per_minute' => (int) env('PUBLIC_EXPORT_RATE_LIMIT', 20),

    // API key v1 per kunci (fallback ke IP bila belum terautentikasi).
    'api_per_minute' => (int) env('API_RATE_LIMIT', 120),

    // Retensi audit log (hari) untuk command audit:prune.
    'audit_retention_days' => (int) env('AUDIT_RETENTION_DAYS', 365),
];
