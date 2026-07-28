<?php

namespace Tests\Feature;

use App\Models\ApiAccessRequest;
use App\Models\ApiKey;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Alur perizinan API: peneliti wajib mengajukan izin (tujuan penggunaan) &
 * disetujui admin sebelum bisa membuat API key. Admin/BPBD Provinsi dibebaskan.
 */
final class ApiAccessRequestTest extends TestCase
{
    use DatabaseTransactions;

    public function test_peneliti_without_permit_cannot_generate_key(): void
    {
        $peneliti = $this->makeUser('peneliti');

        $this->actingAs($peneliti)
            ->postJson('/api/research/api-keys')
            ->assertStatus(403);

        $this->assertSame(0, ApiKey::where('user_id', $peneliti->id)->count());
    }

    public function test_peneliti_submits_permit_and_admin_approves_then_key_works(): void
    {
        $peneliti = $this->makeUser('peneliti');

        $this->actingAs($peneliti)
            ->postJson('/api/research/api-access-request', [
                'purpose' => 'Penelitian skripsi analisis pola banjir rob pesisir Lampung.',
                'organization' => 'Universitas Lampung',
            ])
            ->assertStatus(201);

        $permit = ApiAccessRequest::where('user_id', $peneliti->id)->firstOrFail();
        $this->assertSame('menunggu', $permit->status);
        $this->assertSame(1, AuditLog::where('action', 'request_api_access')->count());

        // Pengajuan kedua saat masih menunggu ditolak.
        $this->actingAs($peneliti)
            ->postJson('/api/research/api-access-request', [
                'purpose' => 'Pengajuan ganda seharusnya ditolak karena masih menunggu.',
            ])
            ->assertStatus(422);

        // Admin menyetujui.
        $admin = $this->makeUser('admin');
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)
            ->postJson("/api/admin/api-access-requests/{$permit->id}/approve")
            ->assertOk();

        $this->assertSame('disetujui', $permit->fresh()->status);

        // Peneliti menerima notifikasi hasil peninjauan (inbox).
        $this->assertSame(1, \Illuminate\Support\Facades\DB::table('notification_inbox')
            ->where('user_id', $peneliti->id)
            ->where('type', 'api_access')
            ->count());

        // Kini peneliti bisa membuat key.
        $this->app['auth']->forgetGuards();
        $this->actingAs($peneliti)
            ->postJson('/api/research/api-keys')
            ->assertStatus(201)
            ->assertJsonStructure(['raw_key']);

        $this->assertSame(1, ApiKey::where('user_id', $peneliti->id)->where('status', 'aktif')->count());
    }

    public function test_admin_reject_blocks_key_and_allows_resubmit(): void
    {
        $peneliti = $this->makeUser('peneliti');
        $permit = ApiAccessRequest::create([
            'id' => (string) Str::uuid(),
            'user_id' => $peneliti->id,
            'purpose' => 'Permohonan awal yang akan ditolak admin.',
            'status' => 'menunggu',
        ]);

        $admin = $this->makeUser('admin');
        $this->actingAs($admin)
            ->postJson("/api/admin/api-access-requests/{$permit->id}/reject", ['review_note' => 'Tujuan kurang jelas.'])
            ->assertOk();

        $this->assertSame('ditolak', $permit->fresh()->status);

        // Masih tak boleh buat key.
        $this->app['auth']->forgetGuards();
        $this->actingAs($peneliti)
            ->postJson('/api/research/api-keys')
            ->assertStatus(403);

        // Boleh mengajukan ulang setelah ditolak.
        $this->actingAs($peneliti)
            ->postJson('/api/research/api-access-request', [
                'purpose' => 'Pengajuan ulang dengan tujuan yang lebih jelas dan rinci.',
            ])
            ->assertStatus(201);
    }

    /** Hanya `peneliti` yang butuh izin; peran lain (kini admin) langsung bisa. */
    public function test_admin_generates_key_without_permit(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)
            ->postJson('/api/research/api-keys')
            ->assertStatus(201);

        $this->assertSame(1, ApiKey::where('user_id', $admin->id)->count());
    }

    private function makeUser(string $role, string $status = 'aktif'): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' API Test',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => $role,
            'status' => $status,
        ]);
    }
}
