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
 * Antrean operator: validasi/tolak/ubah-status laporan `menunggu`/`perlu_review`,
 * audit log per aksi, laporan terproses keluar dari antrean & tak bisa diproses
 * ulang (409), dan batas wilayah kerja operator (403 lintas kabupaten).
 * Scoping daftar antrean per wilayah sudah dicakup ApiFoundationTest.
 */
final class OperatorQueueTest extends TestCase
{
    use DatabaseTransactions;

    private const QUEUE_URL = '/api/reports?status=menunggu,perlu_review&per_page=100';

    public function test_operator_validates_menunggu_report_and_it_leaves_the_queue(): void
    {
        [$region, $operator] = $this->makeRegionWithOperator('Kabupaten Antrean Validasi');
        $report = $this->makeReport($region, 'menunggu');

        $this->actingAs($operator)->getJson(self::QUEUE_URL)
            ->assertOk()
            ->assertJsonFragment(['report_code' => $report->report_code]);

        $this->postJson("/api/reports/{$report->id}/validate")
            ->assertOk()
            ->assertJsonPath('data.status', 'divalidasi')
            ->assertJsonPath('data.validator.id', $operator->id);

        $fresh = $report->fresh();
        $this->assertSame('divalidasi', $fresh->status);
        $this->assertSame($operator->id, $fresh->validated_by);
        $this->assertNotNull($fresh->validated_at);

        $this->getJson(self::QUEUE_URL)
            ->assertOk()
            ->assertJsonMissing(['report_code' => $report->report_code]);

        $this->assertAudit('validate_report', $report->id);
    }

    public function test_operator_rejects_perlu_review_report_with_mandatory_reason(): void
    {
        [$region, $operator] = $this->makeRegionWithOperator('Kabupaten Antrean Tolak');
        $report = $this->makeReport($region, 'perlu_review');

        $this->actingAs($operator)
            ->postJson("/api/reports/{$report->id}/reject", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
        $this->assertSame('perlu_review', $report->fresh()->status);

        $this->postJson("/api/reports/{$report->id}/reject", ['reason' => 'Foto tidak menunjukkan genangan rob.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'ditolak');

        $fresh = $report->fresh();
        $this->assertSame('Foto tidak menunjukkan genangan rob.', $fresh->rejection_reason);
        $this->assertSame($operator->id, $fresh->validated_by);

        $this->getJson(self::QUEUE_URL)
            ->assertOk()
            ->assertJsonMissing(['report_code' => $report->report_code]);

        $this->assertAudit('reject_report', $report->id);
    }

    public function test_update_status_requires_reason_for_ditolak_and_clears_validator_for_duplikat(): void
    {
        [$region, $operator] = $this->makeRegionWithOperator('Kabupaten Antrean Status');
        $report = $this->makeReport($region, 'menunggu');

        $this->actingAs($operator)
            ->patchJson("/api/reports/{$report->id}/status", ['status' => 'ditolak'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['rejection_reason']);

        $this->patchJson("/api/reports/{$report->id}/status", ['status' => 'duplikat'])
            ->assertOk()
            ->assertJsonPath('data.status', 'duplikat');

        $fresh = $report->fresh();
        $this->assertNull($fresh->validated_by);
        $this->assertNull($fresh->validated_at);

        $this->assertAudit('update_report_status', $report->id);
    }

    public function test_processed_report_cannot_be_processed_again(): void
    {
        [$region, $operator] = $this->makeRegionWithOperator('Kabupaten Antrean Ulang');
        $report = $this->makeReport($region, 'divalidasi');

        $this->actingAs($operator)
            ->postJson("/api/reports/{$report->id}/validate")
            ->assertStatus(409);
        $this->postJson("/api/reports/{$report->id}/reject", ['reason' => 'coba tolak ulang'])
            ->assertStatus(409);

        $this->assertSame('divalidasi', $report->fresh()->status);
    }

    public function test_operator_cannot_process_report_outside_work_area(): void
    {
        [$regionA] = $this->makeRegionWithOperator('Kabupaten Wilayah Sendiri');
        $reportA = $this->makeReport($regionA, 'menunggu');

        $regionB = $this->insertRegion('Kota Wilayah Lain');
        $operatorB = $this->makeUser('bpbd_operator', $regionB->id);

        $this->actingAs($operatorB)
            ->postJson("/api/reports/{$reportA->id}/validate")
            ->assertForbidden();

        $this->assertSame('menunggu', $reportA->fresh()->status);
    }

    public function test_operator_without_work_region_cannot_process_reports(): void
    {
        [$region] = $this->makeRegionWithOperator('Kabupaten Tanpa Operator');
        $report = $this->makeReport($region, 'menunggu');
        $operatorWithoutRegion = $this->makeUser('bpbd_operator', null);

        $this->actingAs($operatorWithoutRegion)
            ->postJson("/api/reports/{$report->id}/validate")
            ->assertForbidden();

        $this->assertSame('menunggu', $report->fresh()->status);
    }

    /** @return array{0: Region, 1: User} */
    private function makeRegionWithOperator(string $regency): array
    {
        $region = $this->insertRegion($regency);

        return [$region, $this->makeUser('bpbd_operator', $region->id)];
    }

    private function assertAudit(string $action, string $reportId): void
    {
        $this->assertTrue(
            AuditLog::where('action', $action)->where('outcome', 'success')
                ->where('target_resource', "ground_truth_reports:{$reportId}")->exists(),
            "Audit log [{$action}] untuk laporan [{$reportId}] tidak ditemukan.",
        );
    }

    private function makeUser(string $role, ?string $regionId): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Antrean Test',
            'email' => Str::uuid().'@example.test',
            'role' => $role,
            'status' => 'aktif',
            'region_id' => $regionId,
        ]);
    }

    private function makeReport(Region $region, string $status): GroundTruthReport
    {
        $reporter = $this->makeUser('warga', null);

        return GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => 'ANTRI-'.Str::upper(Str::random(10)),
            'user_id' => $reporter->id,
            'region_id' => $region->id,
            'latitude' => -5.445,
            'longitude' => 105.260,
            'severity' => 'sedang',
            'water_height_cm' => 25,
            'incident_time' => now(),
            'description' => 'Laporan uji antrean operator.',
            'status' => $status,
            'validated_by' => $status === 'divalidasi' ? $reporter->id : null,
            'validated_at' => $status === 'divalidasi' ? now() : null,
        ]);
    }

    private function insertRegion(string $regency): Region
    {
        $id = (string) Str::uuid();
        $geometry = 'MULTIPOLYGON(((105.25 -5.455,105.27 -5.455,105.27 -5.435,105.25 -5.435,105.25 -5.455)))';
        $postgisInstalled = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgisInstalled ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', ?, 'Kecamatan Antrean', 'Kelurahan Antrean', {$geometrySql}, 1000, true, 'FeatureTest', 'operator-queue-test', 'demo', now(), now())",
            [$id, $regency, $geometry],
        );

        return Region::findOrFail($id);
    }
}
