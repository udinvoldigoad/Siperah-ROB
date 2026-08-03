<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Models\User;
use Carbon\Carbon;

class PasswordResetController
{
    /**
     * Pesan seragam agar respons tidak membocorkan keberadaan email/record
     * (anti user-enumeration). Kegagalan verifikasi tak pernah membeda-bedakan
     * "email tak terdaftar" vs "OTP salah" vs "kedaluwarsa".
     */
    private const GENERIC_SENT = 'Jika email terdaftar, kode OTP telah dikirim. Periksa inbox atau folder spam Anda.';
    private const GENERIC_INVALID = 'Kode OTP salah atau sudah kedaluwarsa. Periksa kembali atau minta kode baru.';
    private const MAX_ATTEMPTS = 5;

    /**
     * Step 1: Generate kode OTP 6 digit dan kirim ke email pengguna.
     * Selalu membalas pesan generik; email hanya benar-benar dikirim bila
     * user ada dan belum meminta ulang <60 detik.
     */
    public function sendOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if ($user) {
            $existing = DB::table('password_reset_tokens')->where('email', $user->email)->first();
            $recentlySent = $existing && $existing->created_at
                && Carbon::parse($existing->created_at)->diffInSeconds(now()) < 60;

            if (!$recentlySent) {
                $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

                DB::table('password_reset_tokens')->updateOrInsert(
                    ['email' => $user->email],
                    [
                        // Hanya hash yang disimpan; OTP plaintext TIDAK pernah ditulis
                        // ke DB maupun log (mencegah kebocoran lewat backup/log).
                        'token'      => Hash::make($otp),
                        'otp'        => null,
                        'attempts'   => 0,
                        'expires_at' => now()->addMinutes(10),
                        'created_at' => now(),
                    ]
                );

                try {
                    Mail::raw(
                        "Halo {$user->name},\n\nKode OTP untuk reset kata sandi akun SAIBA Anda adalah:\n\n{$otp}\n\nKode ini berlaku selama 10 menit.\nJika Anda tidak meminta reset kata sandi, abaikan email ini.\n\nSalam,\nTim SAIBA",
                        function ($message) use ($user) {
                            // Pakai From default (config mail.from) agar selaras SPF/DKIM
                            // transport SMTP produksi â€” bukan domain hardcoded.
                            $message->to($user->email)
                                    ->subject('Kode OTP Reset Kata Sandi - SAIBA');
                        }
                    );
                } catch (\Throwable $e) {
                    Log::warning("SMTP gagal mengirim OTP ke {$user->email}: " . $e->getMessage());
                }
            }
        }

        return response()->json(['message' => self::GENERIC_SENT]);
    }

    /**
     * Step 2: Verifikasi OTP dan set password baru sekaligus.
     */
    public function resetWithOtp(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'otp'      => 'required|string|size:6',
            'password' => 'required|string|min:8',
        ]);

        $record = DB::table('password_reset_tokens')->where('email', $request->email)->first();

        // Tidak ada permintaan / token hilang / kedaluwarsa / percobaan habis.
        if (!$record || !$record->token
            || Carbon::parse($record->expires_at)->isPast()
            || ($record->attempts ?? 0) >= self::MAX_ATTEMPTS) {
            if ($record) {
                DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            }
            return response()->json(['message' => self::GENERIC_INVALID], 400);
        }

        // Verifikasi timing-safe terhadap hash (bukan perbandingan plaintext).
        if (!Hash::check($request->otp, $record->token)) {
            $attempts = ($record->attempts ?? 0) + 1;
            if ($attempts >= self::MAX_ATTEMPTS) {
                // Kunci: hapus record agar OTP ini mati setelah 5 kali salah,
                // apa pun IP penyerang (pertahanan utama vs brute-force).
                DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            } else {
                DB::table('password_reset_tokens')->where('email', $request->email)
                    ->update(['attempts' => $attempts]);
            }
            return response()->json(['message' => self::GENERIC_INVALID], 400);
        }

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return response()->json(['message' => self::GENERIC_INVALID], 400);
        }

        $user->forceFill([
            'password_hash' => Hash::make($request->password),
        ])->save();

        // Cabut semua token Sanctum lama: bila akun sudah dikompromikan,
        // reset kata sandi ikut memutus sesi penyerang.
        $user->tokens()->delete();

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        Log::info("Password successfully reset via OTP for {$user->email}");

        return response()->json([
            'message' => 'Kata sandi berhasil diperbarui. Silakan login dengan sandi baru Anda.',
        ]);
    }
}

