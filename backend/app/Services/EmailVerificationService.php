<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * OTP verifikasi email saat pendaftaran mandiri.
 *
 * Higienenya sengaja meniru alur reset kata sandi yang sudah diaudit:
 * hanya HASH yang disimpan (OTP plaintext tak pernah menyentuh DB atau log),
 * kedaluwarsa 10 menit, maksimal 5 percobaan lalu kodenya dimatikan, dan
 * pengiriman ulang dibatasi 60 detik.
 */
final class EmailVerificationService
{
    private const TABLE = 'email_verification_tokens';
    private const EXPIRY_MINUTES = 10;
    private const MAX_ATTEMPTS = 5;
    private const RESEND_COOLDOWN_SECONDS = 60;

    /**
     * Terbitkan & kirim OTP baru. Diam saja bila permintaan sebelumnya belum
     * lewat masa jeda â€” pemanggil selalu membalas pesan generik, jadi jeda ini
     * tak membocorkan apa pun.
     */
    public function send(User $user): void
    {
        $existing = DB::table(self::TABLE)->where('email', $user->email)->first();
        $recentlySent = $existing && $existing->created_at
            && Carbon::parse($existing->created_at)->diffInSeconds(now()) < self::RESEND_COOLDOWN_SECONDS;

        if ($recentlySent) {
            return;
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table(self::TABLE)->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => Hash::make($otp),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(self::EXPIRY_MINUTES),
                'created_at' => now(),
            ],
        );

        try {
            Mail::raw(
                "Halo {$user->name},\n\n"
                ."Kode verifikasi email akun SAIBA Anda adalah:\n\n{$otp}\n\n"
                ."Masukkan kode ini di halaman pendaftaran untuk mengaktifkan akun.\n"
                ."Kode berlaku selama ".self::EXPIRY_MINUTES." menit.\n\n"
                ."Jika Anda tidak mendaftar di SAIBA, abaikan email ini.\n\n"
                ."Salam,\nTim SAIBA",
                function ($message) use ($user) {
                    // From default (config mail.from) agar selaras SPF/DKIM SMTP produksi.
                    $message->to($user->email)->subject('Kode Verifikasi Email - SAIBA');
                },
            );
        } catch (\Throwable $e) {
            // Kegagalan SMTP tidak boleh menggagalkan pendaftaran: akunnya sudah
            // dibuat dan pengguna bisa meminta kirim ulang.
            Log::warning("SMTP gagal mengirim OTP verifikasi ke {$user->email}: ".$e->getMessage());
        }
    }

    /**
     * Verifikasi OTP; mengembalikan user yang sudah diaktifkan, atau null bila
     * kodenya salah/kedaluwarsa/percobaan habis.
     */
    public function verify(string $email, string $otp): ?User
    {
        $record = DB::table(self::TABLE)->where('email', $email)->first();

        if (!$record
            || Carbon::parse($record->expires_at)->isPast()
            || ($record->attempts ?? 0) >= self::MAX_ATTEMPTS) {
            if ($record) {
                DB::table(self::TABLE)->where('email', $email)->delete();
            }

            return null;
        }

        // Timing-safe terhadap hash, bukan perbandingan string biasa.
        if (!Hash::check($otp, $record->token)) {
            $attempts = ($record->attempts ?? 0) + 1;
            if ($attempts >= self::MAX_ATTEMPTS) {
                // Kode dimatikan setelah 5 kali salah â€” pertahanan utama
                // terhadap brute-force 6 digit, berlaku lintas IP.
                DB::table(self::TABLE)->where('email', $email)->delete();
            } else {
                DB::table(self::TABLE)->where('email', $email)->update(['attempts' => $attempts]);
            }

            return null;
        }

        $user = User::where('email', $email)->first();
        DB::table(self::TABLE)->where('email', $email)->delete();

        if (!$user) {
            return null;
        }

        // HANYA menyetel email_verified_at. `status` sengaja tak disentuh:
        // itu wilayah admin, dan akun yang dinonaktifkan/ditolak tidak boleh
        // hidup kembali hanya karena pemiliknya memasukkan OTP.
        $user->email_verified_at = now();
        $user->save();

        return $user;
    }
}

