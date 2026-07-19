<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Alur autentikasi lengkap: login sukses semua role (token terbit & dipakai),
 * kredensial salah, registrasi (default warga+menunggu, tak bisa eskalasi role),
 * dan logout mencabut token. Negative path RBAC dicakup RbacNegativePathTest.
 *
 * Catatan rate limiter: registrasi dibatasi 5/jam per IP (cache array di test,
 * counter berbagi satu proses PHPUnit) — total panggilan /auth/register di file
 * ini dijaga maksimal 4.
 */
final class AuthFlowTest extends TestCase
{
    use DatabaseTransactions;

    private const ALL_ROLES = ['warga', 'peneliti', 'bpbd_operator', 'bpbd_provinsi', 'admin'];

    public function test_login_succeeds_for_every_role_and_token_can_access_me(): void
    {
        foreach (self::ALL_ROLES as $role) {
            $email = Str::uuid().'@example.test';
            $this->makeUser($role, $email);

            $this->app['auth']->forgetGuards();
            $login = $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
                ->assertOk()
                ->assertJsonPath('token_type', 'Bearer')
                ->assertJsonPath('user.role', $role)
                ->assertJsonStructure(['access_token']);

            $this->app['auth']->forgetGuards();
            $this->withHeader('Authorization', 'Bearer '.$login->json('access_token'))
                ->getJson('/api/auth/me')
                ->assertOk()
                ->assertJsonPath('data.email', $email)
                ->assertJsonPath('data.role', $role);
        }
    }

    public function test_login_updates_last_login_and_writes_success_audit(): void
    {
        $email = Str::uuid().'@example.test';
        $user = $this->makeUser('warga', $email);
        $this->assertNull($user->last_login_at);

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])->assertOk();

        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertTrue(
            AuditLog::where('action', 'login')->where('outcome', 'success')
                ->where('target_resource', $email)->exists(),
        );
    }

    public function test_login_with_wrong_password_returns_401_and_writes_fail_audit(): void
    {
        $email = Str::uuid().'@example.test';
        $this->makeUser('warga', $email);

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password-salah'])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Email atau password salah')
            ->assertJsonMissingPath('access_token');

        $this->assertTrue(
            AuditLog::where('action', 'login')->where('outcome', 'fail')
                ->where('target_resource', $email)->exists(),
        );
    }

    public function test_login_with_unknown_email_uses_same_message_as_wrong_password(): void
    {
        // Pesan identik dengan password salah agar tidak membocorkan email terdaftar.
        $this->postJson('/api/auth/login', [
            'email' => Str::uuid().'@tidak-terdaftar.test',
            'password' => 'password123',
        ])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Email atau password salah');
    }

    public function test_register_creates_pending_warga_that_cannot_login_yet(): void
    {
        $email = Str::uuid().'@example.test';

        $this->postJson('/api/auth/register', [
            'name' => 'Warga Baru',
            'email' => $email,
            'password' => 'password123',
        ])
            ->assertCreated()
            ->assertJsonPath('user.role', 'warga')
            ->assertJsonPath('user.status', 'menunggu')
            ->assertJsonMissingPath('access_token');

        $this->assertDatabaseHas('users', ['email' => $email, 'role' => 'warga', 'status' => 'menunggu']);

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('account_status', 'menunggu');
    }

    public function test_register_ignores_role_and_status_escalation_attempt(): void
    {
        $email = Str::uuid().'@example.test';

        $this->postJson('/api/auth/register', [
            'name' => 'Penyusup Admin',
            'email' => $email,
            'password' => 'password123',
            'role' => 'admin',
            'status' => 'aktif',
        ])->assertCreated();

        $this->assertDatabaseHas('users', ['email' => $email, 'role' => 'warga', 'status' => 'menunggu']);
    }

    public function test_register_rejects_duplicate_email_and_short_password(): void
    {
        $email = Str::uuid().'@example.test';
        $this->makeUser('warga', $email);

        $this->postJson('/api/auth/register', [
            'name' => 'Email Kembar',
            'email' => $email,
            'password' => 'password123',
        ])->assertUnprocessable()->assertJsonValidationErrors(['email']);

        $this->postJson('/api/auth/register', [
            'name' => 'Password Pendek',
            'email' => Str::uuid().'@example.test',
            'password' => 'pendek',
        ])->assertUnprocessable()->assertJsonValidationErrors(['password']);
    }

    public function test_logout_revokes_token_and_writes_audit(): void
    {
        $email = Str::uuid().'@example.test';
        $this->makeUser('warga', $email);

        $token = $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertOk()->json('access_token');
        $authorized = fn () => $this->withHeader('Authorization', 'Bearer '.$token);

        $this->app['auth']->forgetGuards();
        $authorized()->getJson('/api/auth/me')->assertOk();

        $this->app['auth']->forgetGuards();
        $authorized()->postJson('/api/auth/logout')->assertOk();

        $this->app['auth']->forgetGuards();
        $authorized()->getJson('/api/auth/me')->assertUnauthorized();

        $this->assertTrue(
            AuditLog::where('action', 'logout')->where('outcome', 'success')
                ->where('target_resource', $email)->exists(),
        );
    }

    private function makeUser(string $role, string $email): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Auth Test',
            'email' => $email,
            'password_hash' => bcrypt('password123'),
            'role' => $role,
            'status' => 'aktif',
        ]);
    }
}
