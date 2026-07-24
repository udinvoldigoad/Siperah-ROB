<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Hapus pengguna oleh admin = soft delete: baris tetap ada (jejak audit/laporan
 * ber-FK NO ACTION tak dilanggar), tapi akun hilang dari query User & tak bisa
 * login. Admin tak boleh menghapus dirinya sendiri; role lain ditolak 403.
 */
final class AdminUserDeleteTest extends TestCase
{
    use DatabaseTransactions;

    public function test_admin_soft_deletes_user_and_writes_audit(): void
    {
        $admin = $this->makeUser('admin');
        $target = $this->makeUser('warga');

        $this->actingAs($admin)
            ->deleteJson("/api/admin/users/{$target->id}")
            ->assertOk()
            ->assertJsonPath('id', $target->id);

        // Soft delete: hilang dari query normal, tapi baris masih ada (trashed).
        $this->assertNull(User::find($target->id));
        $this->assertNotNull(User::withTrashed()->find($target->id));
        $this->assertNotNull(User::withTrashed()->find($target->id)->deleted_at);

        $this->assertSame(
            1,
            AuditLog::where('action', 'delete_user')
                ->where('target_resource', "users:{$target->id}")
                ->where('outcome', 'success')
                ->count(),
        );
    }

    public function test_admin_cannot_delete_own_account(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)
            ->deleteJson("/api/admin/users/{$admin->id}")
            ->assertStatus(422);

        $this->assertNotNull(User::find($admin->id));
    }

    public function test_non_admin_cannot_delete_users(): void
    {
        $target = $this->makeUser('warga');

        foreach (['warga', 'peneliti', 'bpbd_operator', 'bpbd_provinsi'] as $role) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($this->makeUser($role))
                ->deleteJson("/api/admin/users/{$target->id}")
                ->assertStatus(403);
        }

        $this->assertNotNull(User::find($target->id));
    }

    private function makeUser(string $role, string $status = 'aktif'): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Delete Test',
            'email' => Str::uuid().'@example.test',
            'role' => $role,
            'status' => $status,
        ]);
    }
}
