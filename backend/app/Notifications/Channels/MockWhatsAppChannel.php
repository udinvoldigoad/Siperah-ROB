<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class MockWhatsAppChannel
{
    /**
     * Send the given notification.
     */
    public function send(object $notifiable, Notification $notification): void
    {
        if (method_exists($notification, 'toWhatsApp')) {
            $message = $notification->toWhatsApp($notifiable);
            
            // Log as a mock for sending WhatsApp message
            Log::info("Mock WhatsApp Message sent to user {$notifiable->id}: {$message}");
        }
    }
}
