<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditService;
use App\Services\EmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class AuthController
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly EmailVerificationService $emailVerification,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        // withTrashed: akun yang dihapus admin tetap dicari agar pemiliknya bisa
        // memulihkannya (lihat restoreDeletedAccount). Tanpa ini, baris yang
        // ter-soft-delete tersembunyi global scope dan pemiliknya cuma dapat
        // "Email atau password salah" yang menyesatkan.
        $user = User::withTrashed()->where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password_hash)) {
            $this->audit->write($request, 'login', 'fail', $data['email'], [
                'actor_name' => $data['email'],
                'actor_role' => 'guest',
                'reason' => 'invalid_credentials',
            ]);
            return response()->json(['message' => 'Email atau password salah'], 401);
        }

        // Password benar = kepemilikan terbukti, jadi akun boleh dipulihkan —
        // tapi kembali ke antrean admin, bukan langsung aktif.
        if ($user->trashed()) {
            self::restoreDeletedAccount($request, $user, $this->audit);
        }

        // Verifikasi email adalah gerbang TERPISAH dari status akun, dan
        // diperiksa lebih dulu. Keduanya sengaja tidak digabung ke satu kolom:
        // `status` milik admin (aktif/menunggu/nonaktif/ditolak), sedangkan
        // `email_verified_at` milik pengguna. Menumpuk keduanya di `menunggu`
        // membuat login Google tak bisa membedakan "belum verifikasi" dari
        // "sengaja ditahan admin", lalu mengaktifkan akun yang seharusnya tetap
        // tertahan.
        if ($user->email_verified_at === null) {
            $this->audit->write($request, 'login', 'denied', $user->email, [
                'actor_name' => $user->name,
                'actor_role' => $user->role,
                'reason' => 'email_belum_diverifikasi',
            ]);

            return response()->json([
                'message' => 'Email Anda belum diverifikasi. Masukkan kode 6 digit yang kami kirim ke email Anda.',
                'account_status' => $user->status,
                'requires_email_verification' => true,
            ], 403);
        }

        if ($user->status !== 'aktif') {
            $this->audit->write($request, 'login', 'denied', $user->email, [
                'actor_name' => $user->name,
                'actor_role' => $user->role,
                'user_status' => $user->status,
            ]);

            // Pesan spesifik per status agar UI bisa menampilkan panduan yang tepat,
            // plus field account_status yang bisa dibaca frontend.
            $message = match ($user->status) {
                'menunggu' => 'Akun Anda masih menunggu persetujuan admin. Anda akan bisa masuk setelah disetujui.',
                'nonaktif' => 'Akun Anda dinonaktifkan. Hubungi admin untuk mengaktifkannya kembali.',
                'ditolak' => 'Pendaftaran akun Anda ditolak. Hubungi admin untuk informasi lebih lanjut.',
                default => 'Akun Anda belum dapat digunakan. Hubungi admin.',
            };

            return response()->json([
                'message' => $message,
                'account_status' => $user->status,
            ], 403);
        }

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('auth_token')->plainTextToken;

        $request->setUserResolver(fn () => $user);
        $this->audit->write($request, 'login', 'success', $user->email);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => new UserResource($user),
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $isPeneliti = ($data['account_type'] ?? 'warga') === 'peneliti';

        $user = new User([
            'id' => (string) Str::uuid(),
            'name' => $data['name'],
            'email' => $data['email'],
            'password_hash' => Hash::make($data['password']),
            'phone_number' => $data['phone_number'] ?? null,
            'institution' => $data['institution'] ?? null,
            'research_purpose' => $isPeneliti ? $data['research_purpose'] : null,
            'region_id' => $data['region_id'] ?? null,
        ]);
        // `role` & `status` di luar $fillable — disetel eksplisit agar payload
        // registrasi tidak pernah bisa memilih perannya sendiri. Yang boleh
        // dipilih pemohon hanya `account_type`, dan pemetaannya ada di sini.
        //
        // Warga: pendaftaran mandiri tidak perlu persetujuan admin, TAPI wajib
        // membuktikan kepemilikan email lewat OTP. `status` tetap 'aktif' karena
        // admin tak menahan apa pun — yang menahan login adalah
        // `email_verified_at` yang masih null.
        //
        // Peneliti: peran ini membuka data penelitian (unduhan dataset, kunci
        // API), jadi kepemilikan email saja tidak cukup — admin harus menilai
        // kepentingan pemohon lebih dulu. Karena itu status 'menunggu'.
        // Keduanya tetap mengirim OTP: verifikasi email berjalan paralel dengan
        // antrean admin, sehingga admin tak perlu meninjau permohonan dari
        // alamat email yang belum terbukti dimiliki pemohon.
        $user->role = $isPeneliti ? 'peneliti' : 'warga';
        $user->status = $isPeneliti ? 'menunggu' : 'aktif';
        $user->save();

        $this->emailVerification->send($user);

        $this->audit->write($request, 'register', 'success', $user->email, [
            'actor_name' => $user->name,
            'actor_role' => $user->role,
            'status' => $user->status,
            'email_verified' => false,
        ]);

        return response()->json([
            'message' => $isPeneliti
                ? 'Permohonan akun peneliti terkirim. Verifikasi email Anda dengan kode 6 digit yang kami kirim, lalu tunggu persetujuan admin.'
                : 'Registrasi berhasil. Kode verifikasi 6 digit telah dikirim ke email Anda.',
            'requires_email_verification' => true,
            'requires_admin_approval' => $isPeneliti,
            'user' => new UserResource($user)
        ], 201);
    }

    /**
     * Verifikasi OTP pendaftaran → akun langsung aktif.
     */
    public function verifyEmail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $user = $this->emailVerification->verify($data['email'], $data['otp']);

        if (!$user) {
            $this->audit->write($request, 'verify_email', 'fail', $data['email'], [
                'reason' => 'otp_invalid_or_expired',
            ]);

            return response()->json([
                'message' => 'Kode verifikasi salah atau sudah kedaluwarsa. Minta kode baru lalu coba lagi.',
            ], 400);
        }

        $this->audit->write($request, 'verify_email', 'success', $user->email, [
            'actor_name' => $user->name,
            'actor_role' => $user->role,
            'status' => $user->status,
        ]);

        // Verifikasi hanya membuka gerbang milik pengguna. Akun yang masih
        // ditahan admin (mis. permohonan peneliti) belum bisa masuk, jadi
        // pesannya tak boleh menjanjikan "sudah aktif".
        return response()->json([
            'message' => $user->status === 'aktif'
                ? 'Email terverifikasi. Akun Anda sudah aktif — silakan masuk.'
                : 'Email terverifikasi. Permohonan Anda kini menunggu persetujuan admin.',
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Kirim ulang OTP verifikasi. Responsnya SELALU generik supaya endpoint ini
     * tak bisa dipakai memeriksa email mana yang terdaftar.
     */
    public function resendEmailVerification(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $data['email'])->whereNull('email_verified_at')->first();
        if ($user) {
            $this->emailVerification->send($user);
        }

        return response()->json([
            'message' => 'Jika email tersebut terdaftar dan belum terverifikasi, kode baru telah dikirim.',
        ]);
    }

    /**
     * Pulihkan akun yang dihapus admin, TAPI kembalikan ke antrean persetujuan.
     *
     * Dipanggil hanya setelah kepemilikan terbukti — password cocok (login) atau
     * profil Google terverifikasi. Pendaftaran ulang lewat `/auth/register`
     * SENGAJA tidak memulihkan apa pun: di sana siapa saja bisa mengetik email
     * milik orang lain, sehingga pemulihan otomatis akan menyerahkan seluruh
     * riwayat akun (laporan, jejak audit) kepada penebak email.
     *
     * Status dikembalikan ke `menunggu`, bukan `aktif`: admin yang menghapus
     * akun ini biasanya punya alasan, jadi keputusan akhir tetap di tangan admin.
     */
    public static function restoreDeletedAccount(Request $request, User $user, AuditService $audit): void
    {
        $user->restore();
        $user->status = 'menunggu';
        $user->save();

        $audit->write($request, 'restore_account', 'success', $user->email, [
            'actor_name' => $user->name,
            'actor_role' => $user->role,
            'status' => $user->status,
            'reason' => 'pemilik terbukti, menunggu persetujuan ulang admin',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user())
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->audit->write($request, 'logout', 'success', $request->user()->email);
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }
}
