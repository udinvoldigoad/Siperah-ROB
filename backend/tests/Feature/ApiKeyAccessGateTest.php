<?php

namespace Tests\Feature;

use App\Models\ApiKey;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Gerbang pembuatan API key setelah alur perizinan ganda dibuang.
 *
 * Dulu peneliti harus mengajukan izin KEDUA (`api_access_requests`) dan
 * menunggu admin, padahal pendaftarannya sendiri sudah mewajibkan
 * `research_purpose` dan sudah ditahan berstatus `menunggu` sampai admin
 * menyetujui. Dua pertanyaan yang sama di dua layar berbeda.
 *
 * Sekarang gerbangnya cuma satu — di pembuatan akun. Berkas ini mengunci
 * konsekuensinya: peneliti yang AKTIF pasti sudah pernah ditinjau, jadi ia
 * berhak membuat kunci tanpa antre lagi; dan yang belum ditinjau tidak akan
 * pernah punya token untuk sampai ke sini.
 *
 * Sisi pendaftarannya sendiri diuji `ResearcherRegistrationTest`.
 */
final class ApiKeyAccessGateTest extends TestCase
{
    use DatabaseTransactions;

    public function test_active_researcher_creates_key_without_a_second_permit(): void
    {
        $peneliti = $this->makeUser('peneliti');

        $this->actingAs($peneliti)
            ->postJson('/api/research/api-keys')
            ->assertStatus(201)
            ->assertJsonStructure(['raw_key']);

        $this->assertSame(1, ApiKey::where('user_id', $peneliti->id)->where('status', 'aktif')->count());
    }

    public function test_admin_creates_key(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)->postJson('/api/research/api-keys')->assertStatus(201);

        $this->assertSame(1, ApiKey::where('user_id', $admin->id)->count());
    }

    /** Gerbang yang TERSISA: hanya peran peneliti & admin yang boleh sama sekali. */
    public function test_citizen_is_still_refused(): void
    {
        $warga = $this->makeUser('warga');

        $this->actingAs($warga)->postJson('/api/research/api-keys')->assertStatus(403);

        $this->assertSame(0, ApiKey::where('user_id', $warga->id)->count());
    }

    /**
     * Inti kebijakan barunya: peneliti yang belum disetujui tak pernah dapat
     * token, sehingga endpoint kunci tak perlu memeriksa izin lagi. Kalau
     * gerbang login ini bocor, seluruh alasan menghapus izin kedua ikut gugur.
     */
    public function test_unapproved_researcher_never_gets_a_token_at_all(): void
    {
        $email = Str::uuid().'@example.test';
        User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Peneliti Belum Ditinjau',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'email_verified_at' => now(),
            'role' => 'peneliti',
            'status' => 'menunggu',
            'research_purpose' => 'Permohonan yang masih menunggu keputusan admin sehingga belum boleh masuk.',
        ]);

        $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])
            ->assertStatus(403);
    }

    /**
     * Penjaga regresi: endpoint perizinan lama benar-benar lenyap. Tanpa ini,
     * menghidupkannya kembali tak sengaja tidak akan menggagalkan apa pun.
     */
    public function test_the_old_permit_endpoints_are_gone(): void
    {
        $peneliti = $this->makeUser('peneliti');
        $admin = $this->makeUser('admin');

        $this->actingAs($peneliti)->getJson('/api/research/api-access-request')->assertStatus(404);
        $this->actingAs($peneliti)->postJson('/api/research/api-access-request', ['purpose' => 'x'])->assertStatus(404);

        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->getJson('/api/admin/api-access-requests')->assertStatus(404);
    }

    private function makeUser(string $role): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Key Gate',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => $role,
            'status' => 'aktif',
        ]);
    }
}
