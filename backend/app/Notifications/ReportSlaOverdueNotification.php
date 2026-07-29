<?php

namespace App\Notifications;

use App\Notifications\Concerns\RoutesViaPreferredChannels;
use App\Notifications\Data\ReportSummary;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;

class ReportSlaOverdueNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use RoutesViaPreferredChannels;

    /** Cuplikan, bukan model - lihat ReportSummary untuk alasannya. */
    public function __construct(
        public ReportSummary $report
    ) {
        $this->tries = 3;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'report_sla_overdue',
            'title' => 'SLA validasi laporan terlewati',
            'body' => "Laporan {$this->report->code} belum selesai diverifikasi lebih dari 1x24 jam.",
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
            ->action('Cek Laporan', "/#/operator/reports/{$this->report->id}")
            ->data(['report_code' => $this->report->code]);
    }

    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Peringatan: SLA Laporan Terlewati')
            ->line($dbData['body'])
            ->action('Tinjau Sekarang', url('/#/operator/reports/' . $this->report->id));
    }
}
