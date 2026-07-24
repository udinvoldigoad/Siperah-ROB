<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class PasswordResetController
{
    public function sendResetLinkEmail(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $status = Password::broker()->sendResetLink(
            $request->only('email')
        );

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'Link reset kata sandi telah dikirim ke email Anda.']);
        }

        $errorMessage = match ($status) {
            Password::INVALID_USER => 'Alamat email tidak terdaftar dalam sistem.',
            Password::RESET_THROTTLED => 'Terlalu banyak permintaan reset. Silakan tunggu beberapa saat.',
            default => 'Gagal mengirim link reset kata sandi.',
        };

        return response()->json(['message' => $errorMessage], 400);
    }

    public function reset(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:8',
        ]);

        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->forceFill([
                    'password_hash' => Hash::make($password)
                ])->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Kata sandi berhasil diperbarui. Silakan login.']);
        }

        $errorMessage = match ($status) {
            Password::INVALID_USER => 'Alamat email tidak terdaftar dalam sistem.',
            Password::INVALID_TOKEN => 'Token reset kata sandi tidak valid atau sudah kedaluwarsa.',
            Password::RESET_THROTTLED => 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
            default => 'Gagal memperbarui kata sandi.',
        };

        return response()->json(['message' => $errorMessage], 400);
    }
}
