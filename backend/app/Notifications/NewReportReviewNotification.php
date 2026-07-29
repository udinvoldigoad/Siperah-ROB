<?php

namespace App\Notifications;

use App\Notifications\Concerns\RoutesViaPreferredChannels;
use App\Notifications\Data\ReportSummary;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;

class NewReportReviewNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use RoutesViaPreferredChannels;

    /** Cuplikan, bukan model - lihat ReportSummary untuk alasannya. */
    public function __construct(
        public ReportSummary $report,
        public bool $isWithinMonitoringArea
    ) {
        $this->tries = 3;
    }

    public function toDatabase(object $notifiable): array
    {
        $title = $this->isWithinMonitoringArea ? 'Laporan baru perlu validasi' : 'Laporan luar pantauan perlu triase';

        return [
            'type' => 'report_review',
            'title' => $title,
            'body' => "Laporan {$this->report->code} masuk di {$this->report->location}.",
            'data' => [
                'report_id' => $this->report->id,
                'report_code' => $this->report->code,
                'status' => $this->report->status,
            ],
        ];
    }

    public function toWebPush($notifiable, $notification)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new WebPushMessage)
            ->title($dbData['title'])
            ->icon('/logo.png')
            ->body($dbData['body'])
            ->action('Lihat Laporan', "/#/operator/reports/{$this->report->id}")
            ->data(['report_code' => $this->report->code]);
    }

    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Halo, ' . ($notifiable->name ?? 'Petugas'))
            ->line($dbData['body'])
            ->action('Buka Sistem', url('/#/operator/reports/' . $this->report->id));
    }
}
