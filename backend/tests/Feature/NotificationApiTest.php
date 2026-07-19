<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Endpoint pengaturan notifikasi & inbox: default settings user baru, validasi
 * channel/event/jam tenang, persistensi + audit, inbox hanya milik sendiri
 * (urut terbaru), tandai dibaca satu/semua tak bocor lintas user, dan daftar/
 * hapus langganan WebPush. Perilaku pengiriman (quiet hours, dedup, scoping)
 * dicakup NotificationBehaviorTest.
 */
final class NotificationApiTest extends TestCase
{
    use DatabaseTransactions;

    public function test_endpoints_require_authentication(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();
        $this->getJson('/api/notifications/settings')->assertUnauthorized();
        $this->putJson('/api/notifications/settings', [])->assertUnauthorized();
        $this->patchJson('/api/notifications/read-all')->assertUnauthorized();
    }

    public function test_settings_show_creates_defaults_for_new_user(): void
    {
        $user = $this->makeUser();

        $response = $this->actingAs($user)->getJson('/api/notifications/settings')
            ->assertOk()
            ->assertJsonPath('data.user_id', $user->id);

        $this->assertIsArray($response->json('data.channels'));
        $this->assertIsArray($response->json('data.event_types'));
        $this->assertDatabaseHas('notification_settings', ['user_id' => $user->id]);
    }

    public function test_settings_update_rejects_unknown_channel_event_and_bad_time(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->putJson('/api/notifications/settings', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['channels', 'event_types', 'monitored_regions']);

        $this->putJson('/api/notifications/settings', [
            'channels' => ['telegram'],
            'event_types' => ['gempa_bumi'],
            'quiet_start' => '25:00',
            'quiet_end' => '9 malam',
            'monitored_regions' => [],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['channels.0', 'event_types.0', 'quiet_start', 'quiet_end']);
    }

    public function test_settings_update_persists_roundtrip_and_writes_audit(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->putJson('/api/notifications/settings', [
            'channels' => ['browser'],
            'event_types' => ['bahaya_sangat_tinggi'],
            'quiet_start' => '22:00',
            'quiet_end' => '05:30',
            'monitored_regions' => ['Kelurahan Uji Notif'],
        ])->assertOk();

        $this->getJson('/api/notifications/settings')
            ->assertOk()
            ->assertJsonPath('data.channels', ['browser'])
            ->assertJsonPath('data.event_types', ['bahaya_sangat_tinggi'])
            ->assertJsonPath('data.monitored_regions', ['Kelurahan Uji Notif']);

        $this->assertTrue(
            AuditLog::where('action', 'update_notification_settings')
                ->where('actor_user_id', $user->id)->exists(),
        );
    }

    public function test_inbox_lists_only_own_notifications_newest_first(): void
    {
        $user = $this->makeUser();
        $other = $this->makeUser();
        $oldId = $this->insertInbox($user->id, 'Notifikasi lama', now()->subHour());
        $newId = $this->insertInbox($user->id, 'Notifikasi baru', now());
        $this->insertInbox($other->id, 'Milik orang lain', now());

        $response = $this->actingAs($user)->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonMissing(['title' => 'Milik orang lain']);

        $this->assertSame([$newId, $oldId], array_column($response->json('data'), 'id'));
    }

    public function test_mark_read_is_scoped_to_owner(): void
    {
        $user = $this->makeUser();
        $other = $this->makeUser();
        $ownId = $this->insertInbox($user->id, 'Punya sendiri', now());
        $foreignId = $this->insertInbox($other->id, 'Punya orang lain', now());

        $this->actingAs($user)->patchJson("/api/notifications/{$ownId}/read")->assertOk();
        $this->assertNotNull(DB::table('notification_inbox')->where('id', $ownId)->value('read_at'));

        $this->patchJson("/api/notifications/{$foreignId}/read")->assertNotFound();
        $this->assertNull(DB::table('notification_inbox')->where('id', $foreignId)->value('read_at'));

        $this->patchJson('/api/notifications/'.Str::uuid().'/read')->assertNotFound();
    }

    public function test_mark_all_read_only_touches_own_unread(): void
    {
        $user = $this->makeUser();
        $other = $this->makeUser();
        $this->insertInbox($user->id, 'Belum dibaca 1', now()->subMinutes(5));
        $this->insertInbox($user->id, 'Belum dibaca 2', now());
        $foreignId = $this->insertInbox($other->id, 'Jangan tersentuh', now());

        $this->actingAs($user)->patchJson('/api/notifications/read-all')->assertOk();

        $this->assertSame(
            0,
            DB::table('notification_inbox')->where('user_id', $user->id)->whereNull('read_at')->count(),
        );
        $this->assertNull(DB::table('notification_inbox')->where('id', $foreignId)->value('read_at'));
    }

    public function test_webpush_subscription_can_be_registered_and_removed(): void
    {
        $user = $this->makeUser();
        $endpoint = 'https://push.example.test/'.Str::uuid();

        $this->actingAs($user)->postJson('/api/webpush/subscribe', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['endpoint', 'keys.auth', 'keys.p256dh']);

        $this->postJson('/api/webpush/subscribe', [
            'endpoint' => $endpoint,
            'keys' => ['auth' => 'auth-token-uji', 'p256dh' => 'p256dh-key-uji'],
        ])->assertOk();
        $this->assertDatabaseHas('push_subscriptions', ['endpoint' => $endpoint]);

        $this->postJson('/api/webpush/unsubscribe', ['endpoint' => $endpoint])->assertOk();
        $this->assertDatabaseMissing('push_subscriptions', ['endpoint' => $endpoint]);
    }

    private function makeUser(): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Notif Api Test',
            'email' => Str::uuid().'@example.test',
            'role' => 'warga',
            'status' => 'aktif',
        ]);
    }

    private function insertInbox(string $userId, string $title, \DateTimeInterface $createdAt): string
    {
        $id = (string) Str::uuid();
        DB::table('notification_inbox')->insert([
            'id' => $id,
            'user_id' => $userId,
            'type' => 'high_risk_warning',
            'title' => $title,
            'body' => 'Isi notifikasi uji.',
            'data' => json_encode(['source' => 'notification-api-test']),
            'created_at' => $createdAt,
        ]);

        return $id;
    }
}
