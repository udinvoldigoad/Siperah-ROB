<?php

namespace App\Notifications;

use App\Notifications\Concerns\RoutesViaPreferredChannels;
use App\Notifications\Data\ReportSummary;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;

class ReportStatusUpdatedNotification extends Notification implements ShouldQueue
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
        $labels = [
            'divalidasi' => 'Laporan divalidasi',
            'ditolak' => 'Laporan ditolak',
            'perlu_review' => 'Laporan perlu ditinjau',
            'duplikat' => 'Laporan ditandai duplikat',
        ];
        $title = $labels[$this->report->status] ?? 'Status laporan diperbarui';
        $body = "Laporan {$this->report->code} sekarang berstatus {$title}.";

        if ($this->report->status === 'ditolak' && $this->report->rejectionReason) {
            $body .= " Alasan: {$this->report->rejectionReason}";
        }

        return [
            'type' => 'report_status',
            'title' => $title,
            'body' => $body,
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
            ->action('Lihat Laporan', "/#/history")
            ->data(['report_code' => $this->report->code]);
    }

    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Halo, ' . ($notifiable->name ?? 'Pelapor'))
            ->line($dbData['body'])
            ->action('Cek Status Laporan', url('/#/history'));
    }
}
