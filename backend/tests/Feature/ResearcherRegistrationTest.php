<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Pendaftaran mandiri akun peneliti.
 *
 * Bedanya dengan warga hanya pada gerbang admin: peran peneliti membuka data
 * mentah (unduhan dataset, kunci API), jadi kepemilikan email saja tidak cukup
 * - admin harus menilai kepentingan pemohon lebih dulu. Karena itu statusnya
 * berhenti di `menunggu`, sementara verifikasi email tetap berjalan seperti
 * biasa lewat OTP.
 */
final class ResearcherRegistrationTest extends TestCase
{
    use DatabaseTransactions;

    private const PURPOSE = 'Penelitian skripsi tentang pola banjir rob di pesisir Bandar Lampung, memakai laporan tervalidasi.';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_researcher_registration_waits_for_admin_while_citizen_does_not(): void
    {
        $email = $this->registerResearcher()
            ->assertCreated()
            ->assertJsonPath('requires_email_verification', true)
            ->assertJsonPath('requires_admin_approval', true)
            ->assertJsonPath('user.role', 'peneliti')
            ->assertJsonPath('user.status', 'menunggu')
            ->json('user.email');

        $user = User::where('email', $email)->firstOrFail();
        self::assertSame(self::PURPOSE, $user->research_purpose);
        self::assertSame('Universitas Lampung', $user->institution);
        self::assertNull($user->email_verified_at);
    }

    /** Tanpa `account_type`, perilaku lama warga harus utuh. */
    public function test_default_registration_is_still_an_active_citizen(): void
    {
        $email = Str::uuid().'@example.test';
        $this->postJson('/api/auth/register', [
            'name' => 'Warga Biasa',
            'email' => $email,
            'password' => 'password123',
        ])
            ->assertCreated()
            ->assertJsonPath('requires_admin_approval', false)
            ->assertJsonPath('user.role', 'warga')
            ->assertJsonPath('user.status', 'aktif');
    }

    /**
     * `role` & `status` tidak divalidasi di RegisterRequest, jadi keduanya tak
     * pernah sampai ke model. Ini penjaga agar pemohon tak bisa melompati
     * antrean admin (atau menjadi admin) hanya dengan menambah field di payload.
     */
    public function test_payload_cannot_choose_its_own_role_or_skip_the_queue(): void
    {
        $email = Str::uuid().'@example.test';
        $this->postJson('/api/auth/register', [
            'account_type' => 'peneliti',
            'name' => 'Peneliti Nakal',
            'email' => $email,
            'password' => 'password123',
            'institution' => 'Universitas Lampung',
            'research_purpose' => self::PURPOSE,
            'role' => 'admin',
            'status' => 'aktif',
        ])->assertCreated();

        $user = User::where('email', $email)->firstOrFail();
        self::assertSame('peneliti', $user->role);
        self::assertSame('menunggu', $user->status);
    }

    public function test_researcher_fields_are_required_and_purpose_must_be_substantive(): void
    {
        $this->postJson('/api/auth/register', [
            'account_type' => 'peneliti',
            'name' => 'Peneliti Kosong',
            'email' => Str::uuid().'@example.test',
            'password' => 'password123',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['institution', 'research_purpose']);

        $this->postJson('/api/auth/register', [
            'account_type' => 'peneliti',
            'name' => 'Peneliti Singkat',
            'email' => Str::uuid().'@example.test',
            'password' => 'password123',
            'institution' => 'Universitas Lampung',
            'research_purpose' => 'riset',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['research_purpose']);
    }

    /**
     * Dua gerbang berurutan: OTP membuka `email_verified_at`, tapi `status`
     * milik admin tetap tertutup. Verifikasi TIDAK boleh mengaktifkan akun.
     */
    public function test_verifying_email_does_not_bypass_the_admin_queue(): void
    {
        $email = $this->registerResearcher()->assertCreated()->json('user.email');
        $this->app['auth']->forgetGuards();

        $otp = '135790';
        DB::table('email_verification_tokens')->where('email', $email)
            ->update(['token' => Hash::make($otp)]);

        $this->postJson('/api/auth/verify-email', ['email' => $email, 'otp' => $otp])->assertOk();

        $user = User::where('email', $email)->firstOrFail();
        self::assertNotNull($user->email_verified_at);
        self::assertSame('menunggu', $user->status);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('account_status', 'menunggu');
    }

    /**
     * Admin harus melihat alasan ASLI yang ditulis pemohon. Sebelumnya
     * `reason` dikarang dari nama instansi sehingga tak menambah informasi.
     */
    public function test_admin_sees_the_applicants_own_justification(): void
    {
        $email = $this->registerResearcher()->assertCreated()->json('user.email');
        $this->app['auth']->forgetGuards();

        $admin = $this->createAdmin();
        $response = $this->actingAs($admin)->getJson('/api/admin/users?search='.urlencode($email))->assertOk();

        $row = collect($response->json('data'))->firstWhere('email', $email);
        self::assertNotNull($row, 'Permohonan peneliti harus muncul di daftar admin.');
        self::assertSame(self::PURPOSE, $row['permission_workflow']['reason']);
        self::assertSame('Universitas Lampung', $row['permission_workflow']['institution']);
        self::assertFalse(
            $row['permission_workflow']['email_verified'],
            'Admin harus tahu email pemohon belum terbukti sebelum menyetujui.',
        );
    }

    /** Setelah admin menyetujui, peneliti bisa masuk seperti biasa. */
    public function test_approval_unlocks_login(): void
    {
        $email = $this->registerResearcher()->assertCreated()->json('user.email');
        $this->app['auth']->forgetGuards();

        $user = User::where('email', $email)->firstOrFail();
        $user->email_verified_at = now();
        $user->save();

        $admin = $this->createAdmin();
        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/approve")->assertOk();
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertOk()
            ->assertJsonPath('user.role', 'peneliti');
    }

    private function createAdmin(): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Admin Peninjau',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => 'admin',
            'status' => 'aktif',
        ]);
    }

    private function registerResearcher(): TestResponse
    {
        return $this->postJson('/api/auth/register', [
            'account_type' => 'peneliti',
            'name' => 'Peneliti Pemohon',
            'email' => Str::uuid().'@example.test',
            'password' => 'password123',
            'institution' => 'Universitas Lampung',
            'research_purpose' => self::PURPOSE,
        ]);
    }
}
