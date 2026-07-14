<?php

namespace App\Console\Commands;

use App\Models\GroundTruthReport;
use App\Services\NotificationService;
use Illuminate\Console\Command;

final class NotifyOverdueReportSla extends Command
{
    protected $signature = 'reports:notify-overdue-sla';

    protected $description = 'Kirim notifikasi untuk laporan ground truth yang melewati SLA validasi 1x24 jam.';

    public function handle(NotificationService $notifications): int
    {
        $reports = GroundTruthReport::with('region')
            ->whereIn('status', ['menunggu', 'perlu_review'])
            ->where('created_at', '<', now()->subDay())
            ->orderBy('created_at')
            ->limit(500)
            ->get();

        foreach ($reports as $report) {
            $notifications->notifyReportSlaOverdue($report);
        }

        $this->info("Notifikasi SLA diproses untuk {$reports->count()} laporan.");

        return self::SUCCESS;
    }
}
