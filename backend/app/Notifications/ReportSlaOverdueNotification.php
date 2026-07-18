<?php

namespace App\Notifications;

use App\Models\GroundTruthReport;
use App\Notifications\Concerns\RoutesViaPreferredChannels;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;

class ReportSlaOverdueNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use RoutesViaPreferredChannels;

    public function __construct(
        public GroundTruthReport $report
    ) {
        $this->tries = 3;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'report_sla_overdue',
            'title' => 'SLA validasi laporan terlewati',
            'body' => "Laporan {$this->report->report_code} belum selesai diverifikasi lebih dari 1x24 jam.",
            'data' => [
                'report_id' => $this->report->id, 
                'report_code' => $this->report->report_code, 
                'status' => $this->report->status
            ]
        ];
    }

    public function toWebPush($notifiable, $notification)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new WebPushMessage)
            ->title($dbData['title'])
            ->icon('/logo.png')
            ->body($dbData['body'])
            ->action('Cek Laporan', "/operator/reports/{$this->report->report_code}")
            ->data(['report_code' => $this->report->report_code]);
    }

    public function toWhatsApp($notifiable): string
    {
        $dbData = $this->toDatabase($notifiable);
        return "⚠️ *{$dbData['title']}*\n{$dbData['body']}\n\nHarap segera menindaklanjuti laporan di SIPERAH-RoB.";
    }

    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Peringatan: SLA Laporan Terlewati')
            ->line($dbData['body'])
            ->action('Tinjau Sekarang', url('/operator/reports/' . $this->report->report_code));
    }
}
