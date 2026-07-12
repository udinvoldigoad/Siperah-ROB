<?php

namespace Tests\Feature;

use App\Models\ApiKey;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ApiFoundationTest extends TestCase
{
    use DatabaseTransactions;
    public function test_health_endpoint_is_available(): void
    {
        $this->getJson('/')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_login_requires_valid_credentials_shape(): void
    {
        $this->postJson('/api/auth/login', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_public_map_rejects_invalid_date_before_querying_database(): void
    {
        $this->getJson('/api/public/map?date=bukan-tanggal')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    public function test_public_predictions_validates_filter_shape(): void
    {
        $this->getJson('/api/public/predictions?date=12-07-2026&per_page=999')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date', 'per_page']);
    }

    public function test_mode_awam_requires_complete_coordinate_pair(): void
    {
        $this->getJson('/api/public/mode-awam?lat=-5.45')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lon']);
    }

    public function test_protected_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/reports')->assertUnauthorized();
    }

    public function test_research_v1_requires_api_key_instead_of_sanctum(): void
    {
        $this->getJson('/api/v1/predictions/daily')
            ->assertUnauthorized()
            ->assertJsonPath('data', null);
    }

    public function test_valid_scoped_api_key_can_access_research_endpoint(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(), 'name' => 'Integration Researcher',
            'email' => Str::uuid().'@example.test', 'role' => 'peneliti', 'status' => 'aktif',
        ]);
        $rawKey = 'spr_'.Str::random(40);
        ApiKey::create([
            'id' => (string) Str::uuid(), 'user_id' => $user->id,
            'key_hash' => hash('sha256', $rawKey), 'key_prefix' => substr($rawKey, 0, 12).'...',
            'status' => 'aktif', 'scopes' => ['predictions:read'], 'use_count' => 0,
        ]);

        $this->withHeader('X-API-Key', $rawKey)
            ->getJson('/api/v1/predictions/daily?per_page=1')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta']);
    }

    public function test_notification_settings_accept_frontend_time_and_event_contract(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(), 'name' => 'Notification User',
            'email' => Str::uuid().'@example.test', 'role' => 'warga', 'status' => 'aktif',
        ]);
        $this->actingAs($user);

        $this->putJson('/api/notifications/settings', [
            'channels' => ['browser', 'email'],
            'event_types' => ['bahaya_sangat_tinggi', 'pembaruan_model'],
            'quiet_start' => '22:00:00', 'quiet_end' => '06:00:00',
            'monitored_regions' => ['Panjang Utara'],
        ])->assertOk()->assertJsonPath('data.user_id', $user->id);
    }

    public function test_inactive_user_token_is_rejected(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(), 'name' => 'Inactive User',
            'email' => Str::uuid().'@example.test', 'role' => 'warga', 'status' => 'nonaktif',
        ]);
        $this->actingAs($user);

        $this->getJson('/api/auth/me')->assertForbidden();
    }
}
