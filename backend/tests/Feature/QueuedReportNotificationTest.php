<?php

namespace Tests\Feature;

use App\Models\GroundTruthReport;
use App\Models\User;
use App\Notifications\Data\ReportSummary;
use App\Notifications\NewReportReviewNotification;
use App\Notifications\ReportSlaOverdueNotification;
use App\Notifications\ReportStatusUpdatedNotification;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Notifikasi laporan harus selamat melewati antrean walau laporannya keburu
 * dihapus.
 *
 * Dulu notifikasi membawa model GroundTruthReport. SerializesModels menyimpan
 * ID-nya saja, lalu mencari modelnya kembali dengan firstOrFail() saat job
 * dijalankan - jadi laporan yang hilang di antara keduanya menggagalkan job
 * dengan ModelNotFoundException. Di produksi itu menumpuk jadi 45 job gagal
 * setelah tabel laporan sempat dibangun ulang.
 *
 * Catatan penting: `$deleteWhenMissingModels` TIDAK menolong di sini. Laravel
 * membaca properti itu dari kelas JOB, dan job untuk notifikasi selalu
 * SendQueuedNotifications - bukan kelas notifikasi kita.
 *
 * ground_truth_reports TIDAK memakai SoftDeletes, jadi penghapusan laporan
 * bersifat permanen dan skenario ini nyata.
 */
final class QueuedReportNotificationTest extends TestCase
{
    use DatabaseTransactions;

    public function test_notification_survives_a_report_deleted_before_the_queue_runs(): void
    {
        $user = $this->makeUser();
        $report = $this->makeReport($user);
        $summary = ReportSummary::from($report);

        $payloads = [
            'status' => $this->queuePayload($user, new ReportStatusUpdatedNotification($summary)),
            'review' => $this->queuePayload($user, new NewReportReviewNotification($summary, true)),
            'sla' => $this->queuePayload($user, new ReportSlaOverdueNotification($summary)),
        ];

        $report->forceDelete();
        self::assertDatabaseMissing('ground_truth_reports', ['id' => $report->id]);

        foreach ($payloads as $label => $payload) {
            try {
                $job = unserialize($payload);
            } catch (ModelNotFoundException $e) {
                self::fail("Notifikasi [{$label}] gagal dipulihkan dari antrean: {$e->getMessage()}");
            }

            self::assertInstanceOf(SendQueuedNotifications::class, $job);
        }
    }

    /** Isi notifikasi tetap utuh tanpa perlu membaca ulang laporannya. */
    public function test_content_is_captured_at_enqueue_time(): void
    {
        $user = $this->makeUser();
        $report = $this->makeReport($user);
        $report->status = 'ditolak';
        $report->rejection_reason = 'Foto tidak jelas.';
        $report->save();

        $notification = new ReportStatusUpdatedNotification(ReportSummary::from($report));
        $payload = $this->queuePayload($user, $notification);

        $report->forceDelete();

        /** @var SendQueuedNotifications $job */
        $job = unserialize($payload);
        $restored = (fn () => $this->notification)->call($job);
        $data = $restored->toDatabase($user);

        self::assertSame('Laporan ditolak', $data['title']);
        self::assertStringContainsString($report->report_code, $data['body']);
        self::assertStringContainsString('Foto tidak jelas.', $data['body']);
        self::assertSame($report->id, $data['data']['report_id']);
    }

    /** Membungkus notifikasi persis seperti yang dilakukan antrean Laravel. */
    private function queuePayload(User $user, Notification $notification): string
    {
        return serialize(new SendQueuedNotifications(collect([$user]), $notification, ['mail']));
    }

    private function makeUser(): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'name' => 'Pelapor Antrean',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'role' => 'warga',
            'status' => 'aktif',
        ]);
    }

    private function makeReport(User $user): GroundTruthReport
    {
        $id = (string) Str::uuid();
        DB::table('ground_truth_reports')->insert([
            'id' => $id,
            'report_code' => 'ANTRE-'.Str::upper(Str::random(8)),
            'user_id' => $user->id,
            'region_id' => (string) DB::table('regions')->value('id'),
            'latitude' => -5.45,
            'longitude' => 105.26,
            'severity' => 'ringan',
            'incident_time' => now(),
            'description' => 'Laporan uji antrean.',
            'status' => 'menunggu',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return GroundTruthReport::findOrFail($id);
    }
}
