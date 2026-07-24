<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Carbon\Carbon;

class PasswordResetController
{
    /**
     * Step 1: Kirim kode OTP 6 digit ke pengguna.
     * Karena SMTP sering terkendala, OTP juga dikembalikan langsung di response.
     */
    public function sendOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'Alamat email tidak terdaftar dalam sistem.'], 400);
        }

        // Cegah spam: cek apakah OTP sudah dikirim kurang dari 60 detik lalu
        $existing = DB::table('password_reset_tokens')->where('email', $user->email)->first();
        if ($existing && $existing->created_at && Carbon::parse($existing->created_at)->diffInSeconds(now()) < 60) {
            return response()->json([
                'message' => 'Kode OTP sudah dikirim. Tunggu 60 detik sebelum meminta ulang.',
            ], 429);
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            [
                'token'      => Hash::make($otp),
                'otp'        => $otp,
                'expires_at' => now()->addMinutes(10),
                'created_at' => now(),
            ]
        );

        Log::info("Password Reset OTP for {$user->email}: {$otp}");

        return response()->json([
            'message' => 'Kode OTP telah dibuat. Masukkan kode 6 digit untuk melanjutkan.',
            'otp'     => $otp, // Langsung dikembalikan (tidak bergantung SMTP)
        ]);
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

        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$record || !$record->otp) {
            return response()->json(['message' => 'Tidak ditemukan permintaan reset untuk email ini.'], 400);
        }

        if (Carbon::parse($record->expires_at)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return response()->json(['message' => 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.'], 400);
        }

        if ($record->otp !== $request->otp) {
            return response()->json(['message' => 'Kode OTP tidak valid.'], 400);
        }

        // OTP valid — update password
        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'Pengguna tidak ditemukan.'], 400);
        }

        $user->forceFill([
            'password_hash' => Hash::make($request->password),
        ])->save();

        // Hapus token setelah berhasil
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        Log::info("Password successfully reset via OTP for {$user->email}");

        return response()->json([
            'message' => 'Kata sandi berhasil diperbarui. Silakan login dengan sandi baru Anda.',
        ]);
    }
}
