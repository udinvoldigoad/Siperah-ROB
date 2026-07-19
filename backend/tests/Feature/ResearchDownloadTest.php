<?php

namespace Tests\Feature;

use App\Models\ApiKey;
use App\Models\AuditLog;
use App\Models\Dataset;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Research download & API key middleware: format CSV vs JSON di endpoint v1 dan
 * download dataset (plus audit), penolakan key rusak/dicabut/pemilik nonaktif,
 * enforcement scope & role pemilik, hitungan pemakaian atomik + header
 * Authorization alternatif, dan regenerasi key mencabut key lama.
 * Happy path key ber-scope sudah dicakup ApiFoundationTest.
 */
final class ResearchDownloadTest extends TestCase
{
    use DatabaseTransactions;

    public function test_v1_predictions_supports_csv_and_json_with_date_filter(): void
    {
        $region = $this->insertRegion('Kabupaten Riset Unduh');
        $this->makePrediction($region, '2026-07-10', 'tinggi');
        $this->makePrediction($region, '2026-07-15', 'sedang');
        [$rawKey] = $this->makeApiKey($this->makeUser('peneliti'), ['predictions:read']);

        $csv = $this->withHeader('X-API-Key', $rawKey)
            ->get('/api/v1/predictions/daily?format=csv&region='.$region->id)
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $content = $csv->streamedContent();
        $this->assertStringContainsString('prediction_date', $content);
        $this->assertStringContainsString('Kabupaten Riset Unduh', $content);

        $this->app['auth']->forgetGuards();
        $this->withHeader('X-API-Key', $rawKey)
            ->getJson('/api/v1/predictions/daily?region='.$region->id.'&from=2026-07-14&to=2026-07-16')
            ->assertOk()
            ->assertHeader('X-Api-Version', 'v1')
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'total']])
            ->assertJsonFragment(['risk_class' => 'sedang'])
            ->assertJsonMissing(['risk_class' => 'tinggi']);
    }

    public function test_dataset_download_streams_csv_paginates_json_and_writes_audit(): void
    {
        $region = $this->insertRegion('Kabupaten Dataset Unduh');
        $this->makePrediction($region, CarbonImmutable::today()->toDateString(), 'tinggi');
        $dataset = Dataset::create([
            'id' => (string) Str::uuid(),
            'name' => 'Prediksi Harian Uji Unduh',
            'description' => 'Dataset uji unduh riset.',
            'dataset_type' => 'Prediksi Harian',
            'period_start' => '2026-01-01',
            'period_end' => '2026-12-31',
            'resolution' => 'harian',
            'record_count' => 1,
            'license' => 'CC-BY-4.0',
            'visibility' => 'peneliti',
        ]);
        $researcher = $this->makeUser('peneliti');

        $csv = $this->actingAs($researcher)
            ->get("/api/research/datasets/{$dataset->id}/download?format=csv")
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Kabupaten Dataset Unduh', $csv->streamedContent());

        // JSON dipaginasi urut tanggal terbaru; DB dev berisi prediksi nyata
        // sehingga baris seed tak pasti di halaman 1 — cukup uji struktur.
        $json = $this->getJson("/api/research/datasets/{$dataset->id}/download?per_page=5")
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'total']]);
        $this->assertGreaterThanOrEqual(1, $json->json('meta.total'));

        $this->assertSame(
            2,
            AuditLog::where('action', 'download_research_dataset')
                ->where('target_resource', "datasets:{$dataset->id}")->count(),
        );
    }

    public function test_middleware_rejects_malformed_revoked_and_inactive_owner_keys(): void
    {
        $this->withHeader('X-API-Key', 'kunci-tanpa-prefix')
            ->getJson('/api/v1/predictions/daily')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'API key wajib dikirim melalui header X-API-Key.');

        [$revokedKey] = $this->makeApiKey($this->makeUser('peneliti'), ['predictions:read'], revoked: true);
        $this->withHeader('X-API-Key', $revokedKey)
            ->getJson('/api/v1/predictions/daily')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'API key tidak valid, dicabut, atau pemiliknya tidak aktif.');

        [$orphanKey] = $this->makeApiKey($this->makeUser('peneliti', 'nonaktif'), ['predictions:read']);
        $this->withHeader('X-API-Key', $orphanKey)
            ->getJson('/api/v1/predictions/daily')
            ->assertUnauthorized();

        $this->assertGreaterThanOrEqual(
            3,
            AuditLog::where('action', 'api_key_request')->where('outcome', 'denied')->count(),
        );
    }

    public function test_middleware_enforces_scope_and_owner_role(): void
    {
        [$wrongScopeKey] = $this->makeApiKey($this->makeUser('peneliti'), ['tidal:read']);
        $this->withHeader('X-API-Key', $wrongScopeKey)
            ->getJson('/api/v1/predictions/daily')
            ->assertForbidden()
            ->assertJsonPath('message', 'API key tidak memiliki scope predictions:read.');

        [$wargaKey] = $this->makeApiKey($this->makeUser('warga'), ['predictions:read']);
        $this->withHeader('X-API-Key', $wargaKey)
            ->getJson('/api/v1/predictions/daily')
            ->assertForbidden()
            ->assertJsonPath('message', 'Pemilik API key tidak memiliki akses peneliti.');
    }

    public function test_usage_is_counted_and_authorization_apikey_header_works(): void
    {
        [$rawKey, $apiKey] = $this->makeApiKey($this->makeUser('peneliti'), ['predictions:read']);
        $this->assertSame(0, $apiKey->use_count);
        $this->assertNull($apiKey->last_used_at);

        $this->withHeader('X-API-Key', $rawKey)
            ->getJson('/api/v1/predictions/daily?per_page=1')->assertOk();
        $this->withHeader('Authorization', 'ApiKey '.$rawKey)
            ->getJson('/api/v1/predictions/daily?per_page=1')->assertOk();

        $fresh = $apiKey->fresh();
        $this->assertSame(2, $fresh->use_count);
        $this->assertNotNull($fresh->last_used_at);
    }

    public function test_regenerating_key_revokes_previous_active_key(): void
    {
        $researcher = $this->makeUser('peneliti');
        [$oldRawKey, $oldKey] = $this->makeApiKey($researcher, ['predictions:read']);

        $newRawKey = $this->actingAs($researcher)
            ->postJson('/api/research/api-keys')
            ->assertCreated()
            ->json('data.raw_key');
        $this->assertStringStartsWith('spr_', $newRawKey);

        $revoked = $oldKey->fresh();
        $this->assertSame('nonaktif', $revoked->status);
        $this->assertNotNull($revoked->revoked_at);

        $this->withHeader('X-API-Key', $oldRawKey)
            ->getJson('/api/v1/predictions/daily')
            ->assertUnauthorized();
        $this->withHeader('X-API-Key', $newRawKey)
            ->getJson('/api/v1/predictions/daily?per_page=1')
            ->assertOk();
    }

    private function makeUser(string $role, string $status = 'aktif'): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => Str::headline($role).' Riset Test',
            'email' => Str::uuid().'@example.test',
            'role' => $role,
            'status' => $status,
        ]);
    }

    /** @return array{0: string, 1: ApiKey} */
    private function makeApiKey(User $user, array $scopes, bool $revoked = false): array
    {
        $rawKey = 'spr_'.Str::random(40);
        $apiKey = ApiKey::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'key_hash' => hash('sha256', $rawKey),
            'key_prefix' => substr($rawKey, 0, 12).'...',
            'status' => $revoked ? 'nonaktif' : 'aktif',
            'revoked_at' => $revoked ? now() : null,
            'scopes' => $scopes,
            'use_count' => 0,
        ]);

        return [$rawKey, $apiKey];
    }

    private function makePrediction(Region $region, string $date, string $riskClass): Prediction
    {
        return Prediction::create([
            'id' => (string) Str::uuid(),
            'region_id' => $region->id,
            'prediction_date' => $date,
            'risk_probability' => 60,
            'risk_class' => $riskClass,
            'confidence_score' => 82,
            'max_tidal_height' => 1.2,
            'peak_time' => '17:00',
            'model_version' => 'test-v1',
            'generated_at' => now(),
            'data_source' => 'FeatureTest',
            'source_reference' => 'research-download-test',
            'provenance_status' => 'demo',
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
             VALUES (?, 'Lampung', ?, 'Kecamatan Riset', 'Kelurahan Riset', {$geometrySql}, 1100, true, 'FeatureTest', 'research-download-test', 'demo', now(), now())",
            [$id, $regency, $geometry],
        );

        return Region::findOrFail($id);
    }
}
