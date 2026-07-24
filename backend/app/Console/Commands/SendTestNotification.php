<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\TestPushNotification;
use Illuminate\Console\Command;

/**
 * Kirim satu notifikasi push uji ke perangkat yang sudah subscribe.
 * Tidak menulis data domain apa pun (tanpa laporan/prediksi) — hanya memicu
 * Web Push, sehingga aman untuk menguji tanpa mengotori database.
 *
 * Contoh: php artisan notify:test warga@siperah.local
 */
class SendTestNotification extends Command
{
    protected $signature = 'notify:test {email : Email pengguna target} {--note= : Teks pesan uji opsional}';

    protected $description = 'Kirim notifikasi push uji (WebPush) ke perangkat pengguna. Tidak menulis data ke database.';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $user = User::where('email', $email)->first();

        if (!$user) {
            $this->error("Pengguna dengan email {$email} tidak ditemukan.");

            return self::FAILURE;
        }

        $count = $user->pushSubscriptions()->count();
        if ($count === 0) {
            $this->warn("{$user->name} belum mendaftarkan perangkat untuk push.");
            $this->line('Aktifkan dulu "Push Notifikasi Browser" di halaman Pengaturan Notifikasi PADA perangkat target, lalu ulangi.');

            return self::FAILURE;
        }

        $user->notify(new TestPushNotification((string) $this->option('note')));

        $this->info("Notifikasi uji dikirim ke {$count} langganan perangkat milik {$user->name} ({$email}).");
        $this->line('Cek perangkat. Jika tidak muncul: pastikan izin notifikasi = Allow, service worker aktif, dan VAPID key terpasang di .env.');

        return self::SUCCESS;
    }
}
