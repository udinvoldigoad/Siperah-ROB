<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\GroundTruthReport;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Negative path RBAC: memastikan setiap endpoint ber-role menolak role lain
 * dengan 403 (bukan 200/500), tamu ditolak 401, dan akun nonaktif ditolak 403
 * walau role-nya cocok. Positive path sudah dicakup ApiFoundationTest.
 */
final class RbacNegativePathTest extends TestCase
{
    use DatabaseTransactions;

    /** Endpoint GET tanpa parameter → daftar role yang BOLEH mengakses. */
    private const ROLE_MATRIX = [
        '/api/admin/users' => ['admin'],
        '/api/admin/audit-logs' => ['admin'],
        '/api/dashboard/operator/summary' => ['bpbd_operator', 'admin'],
        '/api/dashboard/operator/reports/export' => ['bpbd_operator', 'admin'],
        '/api/dashboard/province/summary' => ['bpbd_provinsi', 'admin'],
        '/api/dashboard/province/export' => ['bpbd_provinsi', 'admin'],
        '/api/research/datasets' => ['peneliti', 'admin'],
        '/api/research/stats' => ['peneliti', 'admin'],
        '/api/research/api-keys' => ['peneliti', 'admin'],
    ];

    private const ALL_ROLES = ['warga', 'peneliti', 'bpbd_operator', 'bpbd_provinsi', 'admin'];

    public function test_role_guarded_endpoints_reject_every_other_role_with_403(): void
    {
        foreach (self::ROLE_MATRIX as $endpoint => $allowedRoles) {
            foreach (self::ALL_ROLES as $role) {
                if (in_array($role, $allowedRoles, true)) {
                    continue;
                }

                $this->app['auth']->forgetGuards();
                $response = $this->actingAs($this->makeUser($role))->getJson($endpoint);
                $this->assertSame(
                    403,
                    $response->status(),
                    "Role [{$role}] seharusnya 403 di [{$endpoint}], dapat {$response->status()}.",
                );
            }
        }
    }

    public function test_guest_gets_401_on_protected_endpoints(): void
    {
        foreach (array_keys(self::ROLE_MATRIX) as $endpoint) {
            $this->assertSame(
                401,
                $this->getJson($endpoint)->status(),
                "Tamu seharusnya 401 di [{$endpoint}].",
            );
        }

        $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->getJson('/api/reports')->assertUnauthorized();
        $this->postJson('/api/reports', [])->assertUnauthorized();
    }

    public function test_inactive_user_with_matching_role_is_still_rejected(): void
    {
        foreach (['menunggu', 'nonaktif', 'ditolak'] as $status) {
            $this->app['auth']->forgetGuards();
            $admin = $this->makeUser('admin', $status);
            $this->actingAs($admin)
                ->getJson('/api/admin/users')
                ->assertForbidden()
                ->assertJsonPath('message', 'Akun tidak aktif atau belum disetujui.');
        }
    }

    public function test_warga_cannot_mutate_report_status_even_for_own_report(): void
    {
        $warga = $this->makeUser('warga');
        $report = $this->makeReport($warga);

        $this->actingAs($warga)
            ->patchJson("/api/reports/{$report->id}/status", ['status' => 'divalidasi'])
            ->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->actingAs($warga)
            ->postJson("/api/reports/{$report->id}/validate")
            ->assertForbidden();

        $this->assertSame('menunggu', $report->fresh()->status);
    }

    public function test_peneliti_cannot_mutate_report_status(): void
    {
        $reporter = $this->makeUser('warga');
        $report = $this->makeReport($reporter);

        $this->actingAs($this->makeUser('peneliti'))
            ->postJson("/api/reports/{$report->id}/reject", ['rejection_reason' => 'coba tolak'])
            ->assertForbidden();

        $this->assertSame('menunggu', $report->fresh()->status);
    }

    public function test_denied_access_is_written_to_audit_log(): void
    {
        $warga = $this->makeUser('warga');
        $before = AuditLog::where('action', 'access_denied')->count();

        $this->actingAs($warga)->getJson('/api/admin/users')->assertForbidden();

        $entry = AuditLog::where('action', 'access_denied')
            ->orderByDesc('created_at')
            ->first();
        $this->assertSame($before + 1, AuditLog::where('action', 'access_denied')->count());
        $this->assertNotNull($entry);
        $this->assertSame('denied', $entry->outcome);
    }

    private function makeUser(string $role, string $status = 'aktif'): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Rbac Test',
            'email' => Str::uuid().'@example.test',
            'role' => $role,
            'status' => $status,
        ]);
    }

    private function makeReport(User $reporter): GroundTruthReport
    {
        $region = $this->makeRegion();

        return GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => 'RBAC-'.Str::upper(Str::random(8)),
            'user_id' => $reporter->id,
            'region_id' => $region->id,
            'latitude' => -5.445,
            'longitude' => 105.260,
            'severity' => 'sedang',
            'water_height_cm' => 20,
            'incident_time' => now(),
            'description' => 'Laporan uji RBAC negative path.',
            'status' => 'menunggu',
        ]);
    }

    private function makeRegion(): Region
    {
        $id = (string) Str::uuid();
        $geometry = 'MULTIPOLYGON(((105.25 -5.455,105.27 -5.455,105.27 -5.435,105.25 -5.435,105.25 -5.455)))';
        $postgisInstalled = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgisInstalled ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', 'Kabupaten Rbac Test', 'Kecamatan Rbac', 'Kelurahan Rbac', {$geometrySql}, 1000, true, 'FeatureTest', 'rbac-negative-path', 'demo', now(), now())",
            [$id, $geometry],
        );

        return Region::findOrFail($id);
    }
}
