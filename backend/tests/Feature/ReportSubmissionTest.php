<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Submit laporan + upload foto: happy path dengan JPG/PNG/WebP tersimpan di disk
 * dan tercatat sebagai ReportPhoto, batas 5 foto & 2MB per foto (boundary tepat),
 * severity diturunkan server dari water_height_cm (input klien diabaikan).
 * Penolakan >5 foto & mime salah sudah dicakup ApiFoundationTest.
 */
final class ReportSubmissionTest extends TestCase
{
    use DatabaseTransactions;

    public function test_submit_with_five_photos_including_webp_stores_files_and_records(): void
    {
        Storage::fake('public');
        $this->insertRegionForPoint(-5.445, 105.260, true);
        $citizen = $this->makeUser();

        $response = $this->actingAs($citizen)->post('/api/reports', [
            ...$this->basePayload(-5.445, 105.260),
            'photos' => [
                UploadedFile::fake()->image('bukti-1.jpg'),
                UploadedFile::fake()->image('bukti-2.jpeg'),
                UploadedFile::fake()->image('bukti-3.png'),
                UploadedFile::fake()->image('bukti-4.webp'),
                UploadedFile::fake()->image('bukti-5.webp'),
            ],
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'menunggu')
            ->assertJsonCount(5, 'data.photos');

        $reportId = $response->json('data.id');
        $photos = DB::table('report_photos')->where('report_id', $reportId)->get();
        $this->assertCount(5, $photos);
        $this->assertContains('image/webp', $photos->pluck('mime_type')->all());
        foreach ($photos as $photo) {
            Storage::disk('public')->assertExists($photo->file_url);
        }

        $this->assertTrue(
            AuditLog::where('action', 'create_report')->where('outcome', 'success')
                ->where('target_resource', "ground_truth_reports:{$reportId}")->exists(),
        );
    }

    public function test_photo_above_2mb_is_rejected_but_exactly_2mb_is_accepted(): void
    {
        Storage::fake('public');
        $this->insertRegionForPoint(-5.545, 105.270, true);

        $this->actingAs($this->makeUser())->postJson('/api/reports', [
            ...$this->basePayload(-5.545, 105.270),
            'photos' => [UploadedFile::fake()->image('kebesaran.jpg')->size(2049)],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photos.0']);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->makeUser())->postJson('/api/reports', [
            ...$this->basePayload(-5.545, 105.270),
            'photos' => [UploadedFile::fake()->image('pas-batas.jpg')->size(2048)],
        ])->assertCreated();
    }

    public function test_severity_is_derived_from_water_height_and_client_input_is_ignored(): void
    {
        $this->insertRegionForPoint(-5.645, 105.280, true);
        $boundaries = [
            9 => 'ringan',
            10 => 'sedang',
            30 => 'sedang',
            31 => 'parah',
            80 => 'parah',
            81 => 'sangat_parah',
        ];

        foreach ($boundaries as $heightCm => $expectedSeverity) {
            $this->app['auth']->forgetGuards();
            // severity 'ringan' dikirim klien tapi harus dihitung ulang server.
            $this->actingAs($this->makeUser())->postJson('/api/reports', [
                ...$this->basePayload(-5.645, 105.280),
                'water_height_cm' => $heightCm,
                'severity' => 'ringan',
            ])
                ->assertCreated()
                ->assertJsonPath('data.severity', $expectedSeverity);
        }
    }

    public function test_submit_requires_core_fields_and_valid_coordinates(): void
    {
        $this->actingAs($this->makeUser())->postJson('/api/reports', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['latitude', 'longitude', 'water_height_cm', 'incident_time', 'description']);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->makeUser())->postJson('/api/reports', [
            ...$this->basePayload(-95, 200),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['latitude', 'longitude']);
    }

    private function basePayload(float $latitude, float $longitude): array
    {
        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'water_height_cm' => 20,
            'incident_time' => now()->toIso8601String(),
            'description' => 'Uji submit laporan dengan dokumentasi foto.',
        ];
    }

    private function makeUser(): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Pelapor Foto Test',
            'email' => Str::uuid().'@example.test',
            'role' => 'warga',
            'status' => 'aktif',
        ]);
    }

    private function insertRegionForPoint(float $latitude, float $longitude, bool $coastal): Region
    {
        $id = (string) Str::uuid();
        $minLon = $longitude - 0.01;
        $maxLon = $longitude + 0.01;
        $minLat = $latitude - 0.01;
        $maxLat = $latitude + 0.01;
        $geometry = "MULTIPOLYGON((({$minLon} {$minLat},{$maxLon} {$minLat},{$maxLon} {$maxLat},{$minLon} {$maxLat},{$minLon} {$minLat})))";
        $postgisInstalled = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $geometrySql = $postgisInstalled ? 'ST_SetSRID(ST_GeomFromText(?), 4326)' : '?';

        DB::statement(
            "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, data_source, source_reference, provenance_status, created_at, updated_at)
             VALUES (?, 'Lampung', 'Kabupaten Foto Test', ?, ?, {$geometrySql}, 1000, ?, 'FeatureTest', 'report-submission-test', 'demo', now(), now())",
            [
                $id,
                $coastal ? 'Pantauan Foto Test' : 'Non Pantauan Foto Test',
                $coastal ? 'Dalam Pantauan Foto' : 'Luar Pantauan Foto',
                $geometry,
                $coastal,
            ],
        );

        return Region::findOrFail($id);
    }
}
