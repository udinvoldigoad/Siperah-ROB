<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

/**
 * Dua invarian alur Google OAuth:
 * 1. Kebijakan akun IDENTIK dengan login/registrasi email-password — pendaftaran
 *    mandiri langsung aktif sebagai warga (keputusan produk), dan akun
 *    berstatus ≠ aktif tetap tidak pernah dapat token. Yang dijaga adalah
 *    KESAMAAN kebijakan: begitu satu jalur lebih longgar, ia jadi celah bagi
 *    jalur satunya.
 * 2. URL redirect hanya membawa kode sekali pakai, tidak pernah token Sanctum —
 *    token hanya melintas di body respons POST /auth/google/exchange.
 */
final class GoogleOAuthTest extends TestCase
{
    use DatabaseTransactions;

    private const FRONTEND = 'http://frontend.test';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.frontend.url' => self::FRONTEND]);
    }

    public function test_new_google_signup_is_active_warga_and_gets_an_exchange_code(): void
    {
        $email = Str::uuid().'@example.test';
        $this->fakeGoogleUser('google-uid-'.Str::uuid(), 'Warga Google', $email);

        // Kebijakan produk: pendaftaran mandiri langsung aktif — SAMA dengan
        // /auth/register. Yang penting keduanya tak pernah berbeda, karena
        // jalur yang lebih longgar akan jadi celah bagi jalur satunya.
        $location = $this->get('/api/auth/google/callback')->headers->get('Location');
        self::assertStringStartsWith(self::FRONTEND.'/#/oauth-callback?code=', $location);

        $user = User::where('email', $email)->firstOrFail();
        self::assertSame('warga', $user->role);
        self::assertSame('aktif', $user->status);

        // Token tetap baru terbit saat kode ditukar, bukan di redirect.
        self::assertNull($user->last_login_at);
        self::assertSame(0, $user->tokens()->count());

        self::assertTrue(
            AuditLog::where('action', 'register')->where('outcome', 'success')
                ->where('target_resource', $email)->exists(),
        );
    }

    public function test_google_signup_cannot_claim_a_privileged_role(): void
    {
        $email = Str::uuid().'@example.test';
        $this->fakeGoogleUser('google-uid-'.Str::uuid(), 'Penyusup Admin', $email);

        $this->get('/api/auth/google/callback');

        // Profil Google tak punya kanal untuk meminta peran, tapi kunci saja
        // invariannya: pendaftaran mandiri SELALU warga.
        self::assertSame('warga', User::where('email', $email)->firstOrFail()->role);
    }

    public function test_callback_redirects_with_one_time_code_and_never_a_token(): void
    {
        $email = Str::uuid().'@example.test';
        $googleId = 'google-uid-'.Str::uuid();
        $user = $this->makeUser($email, 'aktif');
        self::assertNull($user->google_id);

        $this->fakeGoogleUser($googleId, 'Warga Aktif', $email);

        $location = $this->get('/api/auth/google/callback')->headers->get('Location');

        self::assertStringStartsWith(self::FRONTEND.'/#/oauth-callback?code=', $location);
        self::assertStringNotContainsString('token=', $location);
        // Token Sanctum berformat "<id>|<plaintext>"; pastikan tak ada yang bocor
        // ke URL apa pun bentuk parameternya.
        self::assertStringNotContainsString('|', urldecode($location));

        // Redirect belum menyelesaikan login: token & last_login_at baru ada
        // setelah kode ditukar.
        $user->refresh();
        self::assertSame($googleId, $user->google_id);
        self::assertNull($user->last_login_at);
        self::assertSame(0, $user->tokens()->count());
    }

    public function test_exchange_swaps_code_for_token_and_burns_it(): void
    {
        $email = Str::uuid().'@example.test';
        $user = $this->makeUser($email, 'aktif');
        $this->fakeGoogleUser('google-uid-'.Str::uuid(), 'Warga Aktif', $email);

        $code = $this->codeFromCallback();

        $exchange = $this->postJson('/api/auth/google/exchange', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('user.email', $email)
            ->assertJsonStructure(['access_token']);

        $user->refresh();
        self::assertNotNull($user->last_login_at);
        self::assertSame(1, $user->tokens()->count());

        self::assertTrue(
            AuditLog::where('action', 'login')->where('outcome', 'success')
                ->where('target_resource', $email)->exists(),
        );

        // Token hasil penukaran benar-benar dipakai untuk memanggil API.
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$exchange->json('access_token'))
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', $email);

        // Sekali pakai: pemutaran ulang URL dari riwayat peramban tak berguna.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/google/exchange', ['code' => $code])->assertStatus(401);
        self::assertSame(1, $user->fresh()->tokens()->count());
    }

    public function test_exchange_rejects_unknown_code(): void
    {
        $this->postJson('/api/auth/google/exchange', ['code' => Str::random(64)])
            ->assertStatus(401);

        $this->postJson('/api/auth/google/exchange', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_exchange_rechecks_status_when_account_is_disabled_after_callback(): void
    {
        $email = Str::uuid().'@example.test';
        $user = $this->makeUser($email, 'aktif');
        $this->fakeGoogleUser('google-uid-'.Str::uuid(), 'Warga Aktif', $email);

        $code = $this->codeFromCallback();

        // Admin menonaktifkan akun setelah redirect, sebelum kode ditukar.
        $user->status = 'nonaktif';
        $user->save();

        $this->postJson('/api/auth/google/exchange', ['code' => $code])
            ->assertStatus(403)
            ->assertJsonPath('account_status', 'nonaktif')
            ->assertJsonMissingPath('access_token');

        self::assertSame(0, $user->fresh()->tokens()->count());
    }

    public function test_inactive_statuses_are_denied_before_any_token_is_issued(): void
    {
        foreach (['menunggu', 'nonaktif', 'ditolak'] as $status) {
            $email = Str::uuid().'@example.test';
            $user = $this->makeUser($email, $status);
            $this->fakeGoogleUser('google-uid-'.Str::uuid(), 'Warga '.$status, $email);

            $this->get('/api/auth/google/callback')
                ->assertRedirect(self::FRONTEND.'/#/login?error='.$status);

            self::assertSame(0, $user->tokens()->count(), "Status '{$status}' tidak boleh dapat token.");
            self::assertNull($user->fresh()->last_login_at);

            self::assertTrue(
                AuditLog::where('action', 'login')->where('outcome', 'denied')
                    ->where('target_resource', $email)->exists(),
                "Penolakan status '{$status}' harus tercatat di audit log.",
            );
        }
    }

    /** Jalankan callback dan ambil kode sekali pakai dari URL redirect. */
    private function codeFromCallback(): string
    {
        $location = $this->get('/api/auth/google/callback')->headers->get('Location');
        parse_str((string) parse_url(str_replace('/#/', '/', $location), PHP_URL_QUERY), $query);

        self::assertArrayHasKey('code', $query, "Redirect tidak membawa kode: {$location}");

        return $query['code'];
    }

    /**
     * Stub driver Socialite tanpa Mockery (bukan dependensi proyek): cukup
     * `extend()` agar `Socialite::driver('google')` mengembalikan objek yang
     * meniru rantai `->stateless()->user()` yang dipakai controller.
     */
    private function fakeGoogleUser(string $id, string $name, string $email): void
    {
        $socialiteUser = new SocialiteUser();
        $socialiteUser->id = $id;
        $socialiteUser->name = $name;
        $socialiteUser->email = $email;

        Socialite::extend('google', fn () => new class($socialiteUser) {
            public function __construct(private readonly SocialiteUser $user) {}

            public function stateless(): static
            {
                return $this;
            }

            public function user(): SocialiteUser
            {
                return $this->user;
            }
        });

        // Manager meng-cache instance driver; tanpa ini pemanggilan kedua dalam
        // satu test tetap memakai stub sebelumnya.
        Socialite::forgetDrivers();
    }

    private function makeUser(string $email, string $status): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Google OAuth Test',
            'email' => $email,
            'password_hash' => bcrypt('password123'),
            'role' => 'warga',
            'status' => $status,
        ]);
    }
}
