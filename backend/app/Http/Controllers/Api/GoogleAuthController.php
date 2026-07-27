<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Str;

class GoogleAuthController
{
    /**
     * Kode tukar sekali pakai berumur pendek: cukup untuk satu round-trip
     * redirect → POST dari SPA, tapi terlalu singkat untuk berguna bila bocor
     * lewat riwayat peramban.
     */
    private const CODE_TTL_SECONDS = 120;

    public function __construct(private readonly AuditService $audit) {}

    /**
     * Redirect the user to the Google authentication page.
     */
    public function redirect()
    {
        return Socialite::driver('google')->stateless()->redirect();
    }

    /**
     * Obtain the user information from Google.
     */
    public function callback(Request $request)
    {
        $frontendUrl = rtrim(config('services.frontend.url', 'http://localhost:5173'), '/');

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();

            $user = User::where('google_id', $googleUser->id)->orWhere('email', $googleUser->email)->first();

            if (!$user) {
                // Pendaftaran lewat Google = pendaftaran biasa, hanya beda cara
                // membuktikan kepemilikan email. Kebijakan approval-nya WAJIB
                // sama dengan /auth/register (warga + menunggu), kalau tidak
                // tombol "Masuk dengan Google" jadi jalan pintas melewati admin.
                $user = new User([
                    'id' => (string) Str::uuid(),
                    'name' => $googleUser->name,
                    'email' => $googleUser->email,
                ]);
                // Di luar $fillable — disetel eksplisit dari sumber tepercaya
                // (profil Google terverifikasi), bukan dari payload request.
                $user->google_id = $googleUser->id;
                $user->role = 'warga';
                $user->status = 'menunggu';
                $user->save();

                $this->audit->write($request, 'register', 'success', $user->email, [
                    'actor_name' => $user->name,
                    'actor_role' => $user->role,
                    'status' => $user->status,
                    'provider' => 'google',
                ]);
            } else {
                // Update existing user with google_id if not present
                if (!$user->google_id) {
                    $user->google_id = $googleUser->id;
                    $user->save();
                }
            }

            // Cek status user sebelum menerbitkan apa pun — user nonaktif/
            // ditolak/menunggu tidak boleh login, langsung redirect dengan pesan
            // sesuai status. Sejalan dengan AuthController::login yang membalas 403.
            if ($user->status !== 'aktif') {
                $this->audit->write($request, 'login', 'denied', $user->email, [
                    'actor_name' => $user->name,
                    'actor_role' => $user->role,
                    'user_status' => $user->status,
                    'provider' => 'google',
                ]);

                return redirect($frontendUrl . '/#/login?error=' . $user->status);
            }

            // Yang dibawa di URL hanyalah kode tukar sekali pakai, BUKAN token
            // Sanctum: URL redirect mendarat di riwayat peramban (dan berpotensi
            // di log/Referer), sedangkan token asli hanya melintas di body
            // respons POST /auth/google/exchange. Kode hangus begitu ditukar.
            return redirect(
                $frontendUrl . '/#/oauth-callback?code=' . urlencode($this->issueExchangeCode($user))
            );

        } catch (\Exception $e) {
            Log::error('Google Auth Error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'redirect_uri' => config('services.google.redirect'),
                'client_id_set' => !empty(config('services.google.client_id')),
                'client_secret_set' => !empty(config('services.google.client_secret')),
                'frontend_url' => $frontendUrl,
            ]);
            // Router frontend berbasis hash — path "/login?..." tidak pernah
            // dibaca; harus "/#/login?..." agar pesan errornya tampil.
            return redirect($frontendUrl . '/#/login?error=google_auth_failed');
        }
    }

    /**
     * Tukar kode sekali pakai dari callback menjadi token Sanctum. Ini titik di
     * mana login benar-benar selesai: token, `last_login_at`, dan audit sukses
     * terjadi di sini, bukan di redirect.
     */
    public function exchange(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'max:255']]);

        // pull() = ambil sekaligus hapus → kode mati setelah pemakaian pertama,
        // termasuk bila seseorang memutar ulang URL dari riwayat peramban.
        $userId = Cache::pull($this->codeCacheKey($request->string('code')->value()));
        $user = $userId ? User::find($userId) : null;

        if (!$user) {
            $this->audit->write($request, 'login', 'fail', null, [
                'reason' => 'invalid_oauth_code',
                'provider' => 'google',
            ]);

            return response()->json(['message' => 'Kode masuk tidak valid atau sudah kedaluwarsa.'], 401);
        }

        // Status bisa berubah antara callback dan penukaran (mis. admin
        // menonaktifkan akun) — periksa ulang, jangan percaya kode saja.
        if ($user->status !== 'aktif') {
            $this->audit->write($request, 'login', 'denied', $user->email, [
                'actor_name' => $user->name,
                'actor_role' => $user->role,
                'user_status' => $user->status,
                'provider' => 'google',
            ]);

            return response()->json([
                'message' => 'Akun Anda belum dapat digunakan. Hubungi admin.',
                'account_status' => $user->status,
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;
        $user->update(['last_login_at' => now()]);

        $request->setUserResolver(fn () => $user);
        $this->audit->write($request, 'login', 'success', $user->email, ['provider' => 'google']);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => new UserResource($user),
        ]);
    }

    private function issueExchangeCode(User $user): string
    {
        $code = Str::random(64);

        // Hanya hash yang disimpan: dump cache tidak menghasilkan kode yang bisa
        // langsung dipakai (pola sama dengan penyimpanan OTP reset kata sandi).
        Cache::put($this->codeCacheKey($code), $user->id, self::CODE_TTL_SECONDS);

        return $code;
    }

    private function codeCacheKey(string $code): string
    {
        return 'oauth:google:code:' . hash('sha256', $code);
    }
}
