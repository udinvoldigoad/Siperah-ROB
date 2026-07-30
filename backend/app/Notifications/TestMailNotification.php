<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TestMailNotification extends Notification
{
    public function __construct(public string $note = '') {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable)
    {
        $time = now()->timezone('Asia/Jakarta')->format('H:i:s');
        $body = trim(($this->note !== '' ? $this->note.' ' : 'Email uji coba dari SIPERAH-RoB. ')."({$time} WIB)");

        return (new MailMessage)
            ->subject('🔔 Notifikasi Uji SIPERAH-RoB (Email)')
            ->greeting('Halo, ' . ($notifiable->name ?? ''))
            ->line($body)
            ->line('Jika Anda menerima email ini, konfigurasi SMTP sudah benar.')
            ->action('Buka Aplikasi', url('/#/notifications'));
    }
}
