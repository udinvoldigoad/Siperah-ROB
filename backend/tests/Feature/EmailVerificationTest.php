<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

/**
 * Verifikasi email pendaftaran mandiri.
 *
 * Dua gerbang sengaja DIPISAH dan diuji terpisah pula:
 * - `email_verified_at` — milik pengguna, dibuka dengan OTP;
 * - `status` — milik admin (aktif/menunggu/nonaktif/ditolak).
 * Menumpuk keduanya ke satu kolom membuat login Google tak bisa membedakan
 * "belum verifikasi" dari "sengaja ditahan admin".
 *
 * Higiene OTP-nya meniru alur reset kata sandi: hanya hash yang disimpan,
 * kedaluwarsa 10 menit, dan kode mati setelah 5 percobaan salah.
 */
final class EmailVerificationTest extends TestCase
{
    use DatabaseTransactions;

    private const FRONTEND = 'http://frontend.test';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.frontend.url' => self::FRONTEND]);
    }

    public function test_otp_is_stored_hashed_and_never_in_plaintext(): void
    {
        $email = $this->register();

        $row = DB::table('email_verification_tokens')->where('email', $email)->first();
        self::assertNotNull($row);
        self::assertStringStartsWith('$2y$', $row->token, 'OTP wajib disimpan sebagai hash bcrypt.');
        self::assertSame(0, (int) $row->attempts);
        self::assertTrue(now()->lt($row->expires_at));
    }

    public function test_correct_otp_verifies_and_unlocks_login(): void
    {
        $email = $this->register();
        $otp = $this->captureOtp($email);

        $this->postJson('/api/auth/verify-email', ['email' => $email, 'otp' => $otp])
            ->assertOk()
            ->assertJsonPath('user.email', $email);

        self::assertNotNull(User::where('email', $email)->value('email_verified_at'));
        // Token sekali pakai — dihapus setelah berhasil.
        self::assertDatabaseMissing('email_verification_tokens', ['email' => $email]);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertOk()
            ->assertJsonStructure(['access_token']);
    }

    public function test_wrong_otp_counts_attempts_and_dies_after_five(): void
    {
        $email = $this->register();

        for ($i = 1; $i <= 4; $i++) {
            $this->postJson('/api/auth/verify-email', ['email' => $email, 'otp' => '000000'])
                ->assertStatus(400);
            self::assertSame(
                $i,
                (int) DB::table('email_verification_tokens')->where('email', $email)->value('attempts'),
            );
        }

        // Percobaan ke-5 mematikan kode sepenuhnya (lintas IP), bukan sekadar
        // menaikkan penghitung.
        $this->postJson('/api/auth/verify-email', ['email' => $email, 'otp' => '000000'])
            ->assertStatus(400);
        self::assertDatabaseMissing('email_verification_tokens', ['email' => $email]);
        self::assertNull(User::where('email', $email)->value('email_verified_at'));
    }

    public function test_expired_otp_is_rejected(): void
    {
        $email = $this->register();
        $otp = $this->captureOtp($email);

        DB::table('email_verification_tokens')->where('email', $email)
            ->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/auth/verify-email', ['email' => $email, 'otp' => $otp])
            ->assertStatus(400);
        self::assertNull(User::where('email', $email)->value('email_verified_at'));
    }

    /** Verifikasi TIDAK boleh menghidupkan akun yang ditahan/ditolak admin. */
    public function test_verification_never_overrides_an_admin_held_status(): void
    {
        $email = $this->register();
        $otp = $this->captureOtp($email);

        $user = User::where('email', $email)->firstOrFail();
        $user->status = 'nonaktif';
        $user->save();

        $this->postJson('/api/auth/verify-email', ['email' => $email, 'otp' => $otp])->assertOk();

        $fresh = User::where('email', $email)->firstOrFail();
        self::assertNotNull($fresh->email_verified_at, 'Emailnya tetap terverifikasi.');
        self::assertSame('nonaktif', $fresh->status, 'Status milik admin tak boleh berubah.');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('account_status', 'nonaktif');
    }

    public function test_resend_is_generic_and_does_not_reveal_registered_emails(): void
    {
        $known = $this->register();

        $unknownResponse = $this->postJson('/api/auth/resend-verification', ['email' => 'entah@example.test'])
            ->assertOk();
        $knownResponse = $this->postJson('/api/auth/resend-verification', ['email' => $known])
            ->assertOk();

        self::assertSame(
            $unknownResponse->json('message'),
            $knownResponse->json('message'),
            'Pesan untuk email terdaftar & tak terdaftar harus identik.',
        );
        self::assertDatabaseMissing('email_verification_tokens', ['email' => 'entah@example.test']);
    }

    /** Google sudah membuktikan email, jadi OTP tak perlu diminta lagi. */
    public function test_google_signup_is_verified_without_any_otp(): void
    {
        $email = Str::uuid().'@example.test';
        $this->fakeGoogleUser('google-uid-'.Str::uuid(), 'Warga Google', $email);

        $location = $this->get('/api/auth/google/callback')->headers->get('Location');
        self::assertStringStartsWith(self::FRONTEND.'/#/oauth-callback?code=', $location);

        $user = User::where('email', $email)->firstOrFail();
        self::assertNotNull($user->email_verified_at);
        self::assertSame('aktif', $user->status);
        self::assertDatabaseMissing('email_verification_tokens', ['email' => $email]);
    }

    /** Menautkan Google ke akun yang belum verifikasi ikut menuntaskannya. */
    public function test_linking_google_completes_a_pending_verification(): void
    {
        $email = $this->register();
        self::assertNull(User::where('email', $email)->value('email_verified_at'));

        $this->fakeGoogleUser('google-uid-'.Str::uuid(), 'Warga Sama', $email);
        $this->get('/api/auth/google/callback');

        self::assertNotNull(User::where('email', $email)->value('email_verified_at'));
    }

    private function register(): string
    {
        $email = Str::uuid().'@example.test';
        $this->postJson('/api/auth/register', [
            'name' => 'Warga Verifikasi',
            'email' => $email,
            'password' => 'password123',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        return $email;
    }

    /**
     * OTP plaintext memang TIDAK tersimpan di mana pun — itu justru yang diuji
     * `test_otp_is_stored_hashed_...`. Jadi alih-alih menebaknya (brute-force
     * 6 digit terhadap bcrypt = puluhan menit), test menanam hash dari kode yang
     * sudah diketahui. Jalur verifikasi yang diuji tetap sama persis.
     */
    private function captureOtp(string $email): string
    {
        $known = '135790';
        $affected = DB::table('email_verification_tokens')->where('email', $email)
            ->update(['token' => Hash::make($known)]);
        self::assertSame(1, $affected, 'Baris OTP untuk email ini harus ada.');

        return $known;
    }

    private function fakeGoogleUser(string $id, string $name, string $email): void
    {
        $socialiteUser = new SocialiteUser();
        $socialiteUser->id = $id;
        $socialiteUser->name = $name;
        $socialiteUser->email = $email;
        $socialiteUser['email_verified'] = true;

        Socialite::extend('google', fn () => new class($socialiteUser) {
            public function __construct(private readonly SocialiteUser $user) {}
            public function stateless(): static { return $this; }
            public function user(): SocialiteUser { return $this->user; }
        });
        Socialite::forgetDrivers();
    }
}
