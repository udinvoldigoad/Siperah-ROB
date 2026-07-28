<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

/**
 * Akun yang dihapus admin = soft delete: barisnya tetap ada (FK audit_logs &
 * laporan tak boleh dilanggar) tapi disembunyikan global scope.
 *
 * Konsekuensi yang dulu tak tertangani: pencarian pengguna tak menemukannya,
 * sementara index unik `users_email_key` di Postgres TIDAK peduli `deleted_at`.
 * Login Google karena itu mencoba INSERT email yang sebenarnya masih ada dan
 * jatuh ke SQLSTATE 23505 — pengguna hanya melihat "Gagal masuk dengan Google".
 *
 * Kebijakan sekarang: pemilik yang terbukti (password cocok / profil Google)
 * memulihkan akunnya, TAPI kembali ke antrean `menunggu` — keputusan akhir tetap
 * di admin. Pendaftaran ulang lewat /auth/register sengaja TIDAK memulihkan,
 * karena di sana kepemilikan tidak dibuktikan sama sekali.
 */
final class DeletedAccountRestoreTest extends TestCase
{
    use DatabaseTransactions;

    private const FRONTEND = 'http://frontend.test';

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        config(['services.frontend.url' => self::FRONTEND]);
    }

    public function test_google_login_restores_deleted_account_into_pending_instead_of_crashing(): void
    {
        $email = Str::uuid().'@example.test';
        $googleId = 'google-uid-'.Str::uuid();
        $user = $this->makeUser($email, $googleId);
        $user->delete();

        self::assertSoftDeleted('users', ['id' => $user->id]);

        $this->fakeGoogleUser($googleId, 'Pemilik Sah', $email);
        $this->get('/api/auth/google/callback')
            ->assertRedirect(self::FRONTEND.'/#/login?error=menunggu');

        $restored = User::withTrashed()->findOrFail($user->id);
        self::assertNull($restored->deleted_at, 'Akun seharusnya dipulihkan.');
        self::assertSame('menunggu', $restored->status);
        self::assertSame(0, $restored->tokens()->count(), 'Belum boleh dapat token sebelum admin menyetujui.');

        // Tidak ada baris kembar: pemulihan, bukan pembuatan akun baru.
        self::assertSame(1, User::withTrashed()->where('email', $email)->count());

        self::assertTrue(
            AuditLog::where('action', 'restore_account')->where('target_resource', $email)->exists(),
            'Pemulihan akun harus tercatat di audit log.',
        );
    }

    public function test_password_login_restores_deleted_account_into_pending(): void
    {
        $email = Str::uuid().'@example.test';
        $user = $this->makeUser($email);
        $user->delete();

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('account_status', 'menunggu');

        $restored = User::withTrashed()->findOrFail($user->id);
        self::assertNull($restored->deleted_at);
        self::assertSame('menunggu', $restored->status);
    }

    public function test_wrong_password_neither_restores_nor_reveals_the_account(): void
    {
        $email = Str::uuid().'@example.test';
        $user = $this->makeUser($email);
        $user->delete();

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password-salah'])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Email atau password salah');

        self::assertSoftDeleted('users', ['id' => $user->id]);
    }

    /**
     * Registrasi TIDAK membuktikan kepemilikan — siapa pun bisa mengetik email
     * orang lain. Memulihkan di sini akan menyerahkan riwayat akun (laporan,
     * jejak audit) kepada penebak email.
     */
    public function test_registering_with_a_deleted_email_does_not_restore_the_account(): void
    {
        $email = Str::uuid().'@example.test';
        $user = $this->makeUser($email);
        $user->delete();

        $this->postJson('/api/auth/register', [
            'name' => 'Penebak Email',
            'email' => $email,
            'password' => 'password-penyerang',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $stillDeleted = User::withTrashed()->findOrFail($user->id);
        self::assertNotNull($stillDeleted->deleted_at, 'Akun tak boleh dipulihkan oleh pendaftaran ulang.');
        // Password lama tetap utuh — penyerang tak bisa menimpanya.
        self::assertTrue(Hash::check('password123', $stillDeleted->password_hash));
    }

    private function makeUser(string $email, ?string $googleId = null): User
    {
        $user = User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Akun Terhapus Test',
            'email' => $email,
            'email_verified_at' => now(),
            'password_hash' => Hash::make('password123'),
            'role' => 'warga',
            'status' => 'aktif',
        ]);

        if ($googleId) {
            $user->google_id = $googleId;
            $user->save();
        }

        return $user;
    }

    private function fakeGoogleUser(string $id, string $name, string $email): void
    {
        $socialiteUser = new SocialiteUser();
        $socialiteUser->id = $id;
        $socialiteUser->name = $name;
        $socialiteUser->email = $email;

        Socialite::extend('google', fn () => new class($socialiteUser) {
            public function __construct(private readonly SocialiteUser $user) {}
            public function stateless(): static { return $this; }
            public function user(): SocialiteUser { return $this->user; }
        });
        Socialite::forgetDrivers();
    }
}
