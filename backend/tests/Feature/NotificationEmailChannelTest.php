<?php

namespace Tests\Feature;

use App\Models\NotificationSetting;
use App\Models\User;
use App\Notifications\ApiAccessReviewedNotification;
use App\Notifications\HighRiskWarningNotification;
use App\Notifications\ReportStatusUpdatedNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Setiap notifikasi harus sampai ke email pemilik akun.
 *
 * Baris `notification_settings` dibuat MALAS - hanya ketika halaman pengaturan
 * dibuka atau ketika jalur notifikasi tertentu kebetulan memanggil
 * `NotificationService::settings()`. Akun yang belum pernah menyentuh keduanya
 * karena itu tidak punya baris sama sekali, dan `via()` dulu menjatuhkannya ke
 * inbox saja - emailnya tak pernah terkirim padahal defaultnya browser + email.
 *
 * Jalur yang TIDAK memanggil settings() (SLA overdue, hasil tinjauan izin API)
 * adalah yang paling sering terkena.
 */
final class NotificationEmailChannelTest extends TestCase
{
    use DatabaseTransactions;

    public function test_account_without_saved_preferences_still_gets_email(): void
    {
        $user = $this->makeUser();
        self::assertDatabaseMissing('notification_settings', ['user_id' => $user->id]);

        $channels = (new HighRiskWarningNotification('2026-07-29', ['Kelurahan Uji'], 1))->via($user);

        self::assertContains('mail', $channels, 'Akun tanpa baris pengaturan tetap harus dikirimi email.');
    }

    /** Semua jenis notifikasi memakai trait yang sama - dijaga agar tetap begitu. */
    public function test_every_notification_type_routes_to_email_by_default(): void
    {
        $user = $this->makeUser();

        foreach ([
            new ApiAccessReviewedNotification('disetujui'),
            new HighRiskWarningNotification('2026-07-29', ['Kelurahan Uji'], 1),
        ] as $notification) {
            self::assertContains(
                'mail',
                $notification->via($user),
                get_class($notification).' harus punya kanal email.',
            );
        }

        self::assertTrue(
            method_exists(ReportStatusUpdatedNotification::class, 'toMail'),
            'Notifikasi status laporan wajib punya isi email.',
        );
    }

    /** Mematikan kanal email secara eksplisit tetap dihormati. */
    public function test_explicit_opt_out_is_respected(): void
    {
        $user = $this->makeUser();
        NotificationSetting::forceCreate([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'channels' => ['browser'],
            'event_types' => NotificationSetting::DEFAULT_EVENT_TYPES,
            'monitored_regions' => [],
        ]);

        $channels = (new HighRiskWarningNotification('2026-07-29', ['Kelurahan Uji'], 1))->via($user);

        self::assertNotContains('mail', $channels);
    }

    /** Email tujuan diambil dari akun penerima, bukan alamat global. */
    public function test_email_is_routed_to_the_accounts_own_address(): void
    {
        $user = $this->makeUser();

        self::assertSame($user->email, $user->routeNotificationFor('mail'));
    }

    private function makeUser(): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Penerima Notifikasi',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => 'warga',
            'status' => 'aktif',
        ]);
    }
}
