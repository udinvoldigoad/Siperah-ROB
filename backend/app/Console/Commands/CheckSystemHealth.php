<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Observability minimal: agregasi sinyal yang SUDAH ada (data_import_runs,
 * failed_jobs, log Laravel) jadi satu ringkasan yang bisa dicek manual lewat
 * SSH atau dibaca dari log server (LOG_LEVEL=warning di production, jadi
 * temuan di sini otomatis masuk log harian yang ditahan 14 hari).
 *
 * Belum ada kanal alert aktif (SMTP/webhook) — production tidak punya
 * MAIL_* terisi. Command ini dijadwalkan agar temuan tercatat konsisten;
 * menyambungkannya ke notifikasi nyata tinggal tambah channel saat kanal
 * alert (email/Telegram/dll) diputuskan.
 */
final class CheckSystemHealth extends Command
{
    protected $signature = 'system:health-check {--hours=24 : Rentang lookback jam}';
    protected $description = 'Ringkas kegagalan pipeline data, job antrean, dan error log terbaru';

    public function handle(): int
    {
        $hours = (int) $this->option('hours');
        $since = now()->subHours($hours);
        $issues = [];

        $failedRuns = DB::table('data_import_runs')
            ->where('status', 'failed')
            ->where('started_at', '>=', $since)
            ->orderByDesc('started_at')
            ->get(['source', 'dataset_type', 'started_at', 'error_summary']);
        if ($failedRuns->isNotEmpty()) {
            $issues[] = "{$failedRuns->count()} pipeline import gagal dalam {$hours} jam terakhir";
            $this->table(
                ['Source', 'Dataset', 'Waktu', 'Error'],
                $failedRuns->map(fn ($run) => [
                    $run->source,
                    $run->dataset_type,
                    $run->started_at,
                    str($run->error_summary ?? '')->limit(80),
                ]),
            );
        }

        $failedJobsCount = DB::table('failed_jobs')->where('failed_at', '>=', $since)->count();
        if ($failedJobsCount > 0) {
            $issues[] = "{$failedJobsCount} job antrean gagal dalam {$hours} jam terakhir";
        }

        $errorLines = $this->recentErrorLogLines($since);
        if ($errorLines > 0) {
            $issues[] = "{$errorLines} baris ERROR di log Laravel dalam {$hours} jam terakhir";
        }

        foreach ($this->vapidProblems() as $problem) {
            $issues[] = $problem;
        }

        if ($issues === []) {
            $this->info("Sistem sehat — tidak ada kegagalan pipeline, job, atau error log dalam {$hours} jam terakhir.");
            Log::info('system_health_check: clean', ['hours' => $hours]);
            return self::SUCCESS;
        }

        foreach ($issues as $issue) {
            $this->warn($issue);
        }
        Log::warning('system_health_check: ditemukan masalah', ['hours' => $hours, 'issues' => $issues]);
        return self::FAILURE;
    }

    /**
     * Periksa BENTUK kunci VAPID, bukan sekadar ada/tidaknya.
     *
     * Latar: di produksi baris `.env` VAPID_PRIVATE_KEY pernah kehilangan
     * newline sehingga menyatu dengan VAPID_SUBJECT. Nilainya jadi 90 karakter
     * berisi `=` dan `/`, dan SETIAP pengiriman push gagal di
     * `Base64Url::decode()`. Tidak ada yang menyadarinya selama dua hari karena
     * kegagalannya hanya muncul sebagai job antrean gagal — sementara semua
     * pemeriksaan yang ada cuma menanyakan "kuncinya terisi?", bukan "kuncinya
     * berbentuk benar?".
     *
     * Salah bentuk BUKAN berarti kuncinya hilang: kalau publiknya utuh,
     * langganan push yang ada tetap sah. Karena itu masalahnya dilaporkan, tidak
     * memicu regenerasi apa pun.
     *
     * @return string[]
     */
    private function vapidProblems(): array
    {
        $public = (string) config('webpush.vapid.public_key');
        $private = (string) config('webpush.vapid.private_key');
        $subject = (string) config('webpush.vapid.subject');

        // Belum dikonfigurasi sama sekali (mis. dev lokal) bukan masalah —
        // push memang tidak dipakai di situ.
        if ($public === '' && $private === '') {
            return [];
        }

        $problems = [];
        $decode = static function (string $value): string|false {
            if (!preg_match('/^[A-Za-z0-9_-]+$/', $value)) {
                return false;
            }

            return base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4), true);
        };

        $publicRaw = $decode($public);
        if ($publicRaw === false || strlen($publicRaw) !== 65 || $publicRaw[0] !== "\x04") {
            $problems[] = 'VAPID_PUBLIC_KEY salah bentuk (harus base64url, 65 byte, diawali 0x04) — push browser tidak akan terkirim';
        }

        $privateRaw = $decode($private);
        if ($privateRaw === false || strlen($privateRaw) !== 32) {
            $problems[] = 'VAPID_PRIVATE_KEY salah bentuk (harus base64url, 32 byte) — push browser tidak akan terkirim';
        }

        if ($subject === '' || !preg_match('#^(mailto:|https://)#', $subject)) {
            $problems[] = 'VAPID_SUBJECT harus berupa "mailto:..." atau URL https';
        }

        return $problems;
    }

    private function recentErrorLogLines(\DateTimeInterface $since): int
    {
        $count = 0;
        // Cocokkan laravel.log (channel single, default dev/test) maupun
        // laravel-YYYY-MM-DD.log (channel daily, dipakai production).
        foreach (glob(storage_path('logs/laravel*.log')) ?: [] as $path) {
            if (filemtime($path) < $since->getTimestamp() - 86400) {
                continue; // file terlalu lama untuk mungkin berisi baris dalam window
            }
            $handle = fopen($path, 'r');
            if (!$handle) {
                continue;
            }
            while (($line = fgets($handle)) !== false) {
                if (!preg_match('/^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/', $line, $matches)) {
                    continue;
                }
                if (!str_contains($line, '.ERROR:')) {
                    continue;
                }
                try {
                    $timestamp = new \DateTimeImmutable($matches[1]);
                } catch (\Exception) {
                    continue;
                }
                if ($timestamp >= $since) {
                    $count++;
                }
            }
            fclose($handle);
        }

        return $count;
    }
}
