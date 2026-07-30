<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\TestMailNotification;
use App\Notifications\TestPushNotification;
use Illuminate\Console\Command;

/**
 * Kirim satu notifikasi uji. Default: push (WebPush) ke perangkat yang sudah
 * subscribe. Dengan --mail, kirim via email untuk memverifikasi SMTP.
 * Tidak menulis data domain apa pun (tanpa laporan/prediksi) — hanya memicu
 * saluran notifikasi, sehingga aman untuk menguji tanpa mengotori database.
 *
 * Contoh:
 *   php artisan notify:test warga@siperah.local
 *   php artisan notify:test admin@siperah.local --mail
 *   php artisan notify:test admin@siperah.local --mail --note="Tes SMTP"
 */
class SendTestNotification extends Command
{
    protected $signature = 'notify:test {email : Email pengguna target} {--mail : Kirim via email (default: push)} {--note= : Teks pesan uji opsional}';

    protected $description = 'Kirim notifikasi uji (WebPush atau email). Tidak menulis data ke database.';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $viaMail = (bool) $this->option('mail');
        $user = User::where('email', $email)->first();

        if (!$user) {
            $this->error("Pengguna dengan email {$email} tidak ditemukan.");

            return self::FAILURE;
        }

        if ($viaMail) {
            $user->notify(new TestMailNotification((string) $this->option('note')));
            $this->info("Email uji dikirim ke {$user->name} ({$email}).");
            $this->line('Cek kotak masuk. Jika tidak muncul: pastikan SMTP terkonfigurasi di .env dan queue worker berjalan.');

            return self::SUCCESS;
        }

        $count = $user->pushSubscriptions()->count();
        if ($count === 0) {
            $this->warn("{$user->name} belum mendaftarkan perangkat untuk push.");
            $this->line('Aktifkan dulu "Push Notifikasi Browser" di halaman Pengaturan Notifikasi PADA perangkat target, lalu ulangi.');

            return self::FAILURE;
        }

        $user->notify(new TestPushNotification((string) $this->option('note')));

        $this->info("Notifikasi push uji dikirim ke {$count} langganan perangkat milik {$user->name} ({$email}).");
        $this->line('Cek perangkat. Jika tidak muncul: pastikan izin notifikasi = Allow, service worker aktif, dan VAPID key terpasang di .env.');

        return self::SUCCESS;
    }
}
