<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Alur reset kata sandi via OTP (hardened): OTP hanya disimpan sebagai hash,
 * verifikasi timing-safe (Hash::check), lockout setelah 5 percobaan, pencabutan
 * token Sanctum, dan respons seragam anti user-enumeration.
 */
final class OtpPasswordResetTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        // Uji logika OTP, bukan rate limiter — lepas throttle agar tak flaky.
        $this->withoutMiddleware(ThrottleRequests::class);
        DB::table('password_reset_tokens')->delete();
    }

    private function makeUser(string $email, string $password = 'sandi-lama'): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'OTP Test',
            'email' => $email,
            'password_hash' => Hash::make($password),
            'role' => 'warga',
            'status' => 'aktif',
        ]);
    }

    private function seedOtp(string $email, string $otp, array $overrides = []): void
    {
        DB::table('password_reset_tokens')->updateOrInsert(['email' => $email], array_merge([
            'token' => Hash::make($otp),
            'otp' => null,
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'created_at' => now(),
        ], $overrides));
    }

    public function test_send_otp_stores_only_hash_and_returns_generic_message(): void
    {
        Mail::fake();
        $user = $this->makeUser('otp-kirim@example.test');

        $res = $this->postJson('/api/auth/forgot-password', ['email' => $user->email]);

        $res->assertOk()->assertJsonPath('message', fn ($m) => str_contains($m, 'Jika email terdaftar'));
        $record = DB::table('password_reset_tokens')->where('email', $user->email)->first();
        $this->assertNotNull($record);
        $this->assertNotNull($record->token, 'Hash OTP harus tersimpan.');
        $this->assertNull($record->otp, 'OTP plaintext TIDAK boleh disimpan.');
    }

    public function test_send_otp_for_unknown_email_is_generic_and_stores_nothing(): void
    {
        Mail::fake();
        $res = $this->postJson('/api/auth/forgot-password', ['email' => 'tidak-ada@example.test']);

        // Anti-enumeration: respons sama persis dengan email terdaftar.
        $res->assertOk()->assertJsonPath('message', fn ($m) => str_contains($m, 'Jika email terdaftar'));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'tidak-ada@example.test']);
    }

    public function test_reset_with_valid_otp_changes_password_and_revokes_tokens(): void
    {
        $user = $this->makeUser('otp-valid@example.test', 'sandi-lama');
        $user->createToken('sesi-lama'); // simulasikan sesi aktif (mis. penyerang)
        $this->assertSame(1, $user->tokens()->count());
        $this->seedOtp($user->email, '654321');

        $res = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'otp' => '654321',
            'password' => 'sandi-baru-kuat',
        ]);

        $res->assertOk();
        $user->refresh();
        $this->assertTrue(Hash::check('sandi-baru-kuat', $user->password_hash), 'Password harus terganti.');
        $this->assertSame(0, $user->tokens()->count(), 'Token Sanctum lama harus dicabut.');
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_reset_with_wrong_otp_increments_attempts_and_is_generic(): void
    {
        $user = $this->makeUser('otp-salah@example.test');
        $this->seedOtp($user->email, '111111');

        $res = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'otp' => '999999',
            'password' => 'sandi-baru-kuat',
        ]);

        $res->assertStatus(400)->assertJsonPath('message', fn ($m) => str_contains($m, 'salah atau sudah kedaluwarsa'));
        $this->assertSame(1, (int) DB::table('password_reset_tokens')->where('email', $user->email)->value('attempts'));
        $user->refresh();
        $this->assertTrue(Hash::check('sandi-lama', $user->password_hash), 'Password TIDAK boleh berubah saat OTP salah.');
    }

    public function test_reset_locks_out_after_max_attempts(): void
    {
        $user = $this->makeUser('otp-lockout@example.test');
        // attempts sudah 4 (percobaan salah ke-5 memicu lockout).
        $this->seedOtp($user->email, '222222', ['attempts' => 4]);

        $res = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'otp' => '000000',
            'password' => 'sandi-baru-kuat',
        ]);

        $res->assertStatus(400);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);

        // OTP yang benar pun tak lagi berlaku setelah record terhapus (terkunci).
        $this->seedOtp($user->email, '222222');
        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        $again = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email, 'otp' => '222222', 'password' => 'sandi-baru-kuat',
        ]);
        $again->assertStatus(400);
    }

    public function test_reset_with_expired_otp_is_rejected_and_purged(): void
    {
        $user = $this->makeUser('otp-expired@example.test');
        $this->seedOtp($user->email, '333333', ['expires_at' => now()->subMinute()]);

        $res = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'otp' => '333333',
            'password' => 'sandi-baru-kuat',
        ]);

        $res->assertStatus(400)->assertJsonPath('message', fn ($m) => str_contains($m, 'kedaluwarsa'));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }
}
