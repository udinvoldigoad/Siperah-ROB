<?php

namespace App\Notifications;

use App\Models\GroundTruthReport;
use App\Models\NotificationSetting;
use App\Notifications\Channels\MockWhatsAppChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;

class ReportStatusUpdatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public GroundTruthReport $report
    ) {
        $this->tries = 3;
    }

    public function via(object $notifiable): array
    {
        $settings = NotificationSetting::where('user_id', $notifiable->id)->first();
        if (!$settings) {
            return [\App\Notifications\Channels\InboxChannel::class];
        }

        $channels = $settings->channels ?? [];
        $delivery = [\App\Notifications\Channels\InboxChannel::class];

        if (in_array('email', $channels, true)) {
            $delivery[] = 'mail';
        }
        if (in_array('browser', $channels, true)) {
            $delivery[] = WebPushChannel::class;
        }
        if (in_array('whatsapp', $channels, true)) {
            $delivery[] = MockWhatsAppChannel::class;
        }

        return $delivery;
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
        $body = "Laporan {$this->report->report_code} sekarang berstatus {$title}.";
        
        if ($this->report->status === 'ditolak' && $this->report->rejection_reason) {
            $body .= " Alasan: {$this->report->rejection_reason}";
        }
        
        return [
            'type' => 'report_status',
            'title' => $title,
            'body' => $body,
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
            ->action('Lihat Laporan', "/operator/reports/{$this->report->report_code}")
            ->data(['report_code' => $this->report->report_code]);
    }

    public function toWhatsApp($notifiable): string
    {
        $dbData = $this->toDatabase($notifiable);
        return "*{$dbData['title']}*\n{$dbData['body']}\n\nSilakan cek sistem SIPERAH-RoB.";
    }

    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Halo, ' . ($notifiable->name ?? 'Pelapor'))
            ->line($dbData['body'])
            ->action('Cek Status Laporan', url('/operator/reports/' . $this->report->report_code));
    }
}
