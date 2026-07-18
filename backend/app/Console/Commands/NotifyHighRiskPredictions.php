<?php

namespace App\Console\Commands;

use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class NotifyHighRiskPredictions extends Command
{
    protected $signature = 'predictions:notify-high-risk {--date= : Tanggal prediksi (default: hari ini WIB)}';

    protected $description = 'Kirim peringatan kritis untuk wilayah berkelas risiko Sangat Tinggi pada tanggal prediksi.';

    public function handle(NotificationService $notifications): int
    {
        $date = $this->option('date')
            ?: CarbonImmutable::now('Asia/Jakarta')->toDateString();

        $sent = $notifications->notifyHighRiskPredictions($date);

        $this->info("Peringatan risiko Sangat Tinggi {$date} terkirim ke {$sent} penerima.");

        return self::SUCCESS;
    }
}
