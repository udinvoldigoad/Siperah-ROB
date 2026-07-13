<?php

namespace App\Services;

use App\Models\GroundTruthReport;
use App\Models\NotificationSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class NotificationService
{
    public function __construct(private readonly RegionMonitoringService $monitoring) {}

    public function settings(string $userId): NotificationSetting
    {
        return NotificationSetting::firstOrCreate(
            ['user_id' => $userId],
            [
                'id' => (string) Str::uuid(),
                'channels' => ['browser', 'email'],
                'event_types' => ['bahaya_sangat_tinggi', 'laporan_ground_truth', 'peringatan_bmkg'],
                'quiet_start' => '22:00',
                'quiet_end' => '05:00',
                'monitored_regions' => [],
            ],
        );
    }

    public function updateSettings(string $userId, array $data): NotificationSetting
    {
        $settings = $this->settings($userId);
        $settings->fill($data)->save();
        return $settings->refresh();
    }

    public function notifyReportStatus(GroundTruthReport $report): void
    {
        $eventTypes = $this->settings($report->user_id)->event_types ?? [];
        if (!in_array('laporan_ground_truth', $eventTypes, true)) {
            return;
        }

        $labels = [
            'divalidasi' => 'Laporan divalidasi',
            'ditolak' => 'Laporan ditolak',
            'perlu_review' => 'Laporan perlu ditinjau',
            'duplikat' => 'Laporan ditandai duplikat',
        ];
        $title = $labels[$report->status] ?? 'Status laporan diperbarui';
        $body = "Laporan {$report->report_code} sekarang berstatus {$title}.";
        if ($report->status === 'ditolak' && $report->rejection_reason) {
            $body .= " Alasan: {$report->rejection_reason}";
        }

        DB::table('notification_inbox')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $report->user_id,
            'type' => 'report_status',
            'title' => $title,
            'body' => $body,
            'data' => json_encode(['report_id' => $report->id, 'report_code' => $report->report_code, 'status' => $report->status]),
            'created_at' => now(),
        ]);
    }

    public function notifyNewReportForReview(GroundTruthReport $report): void
    {
        $report->loadMissing('region');
        $region = $report->region;

        $isWithinMonitoringArea = $this->monitoring->isReportWithinMonitoringArea($report);

        $recipients = User::query()
            ->where('status', 'aktif')
            ->whereIn('role', ['bpbd_operator', 'bpbd_provinsi', 'admin'])
            ->get()
            ->filter(function (User $user) use ($region, $isWithinMonitoringArea): bool {
                if (in_array($user->role, ['bpbd_provinsi', 'admin'], true)) {
                    return true;
                }

                if (!$isWithinMonitoringArea) {
                    return true;
                }

                if (!$user->region_id || !$region) {
                    return false;
                }

                return DB::table('regions')
                    ->where('id', $user->region_id)
                    ->where('regency', $region->regency)
                    ->exists();
            });

        foreach ($recipients as $recipient) {
            $settings = $this->settings($recipient->id);
            if (!in_array('laporan_ground_truth', $settings->event_types ?? [], true)) {
                continue;
            }

            $monitored = $settings->monitored_regions ?? [];
            if ($monitored !== [] && $region && $isWithinMonitoringArea) {
                $haystack = array_map('mb_strtolower', array_filter([$region->village, $region->district, $region->regency]));
                $matches = collect($monitored)->contains(fn (string $item) => in_array(mb_strtolower($item), $haystack, true));
                if (!$matches) {
                    continue;
                }
            }

            DB::table('notification_inbox')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $recipient->id,
                'type' => 'report_review',
                'title' => $isWithinMonitoringArea ? 'Laporan baru perlu validasi' : 'Laporan luar pantauan perlu triase',
                'body' => "Laporan {$report->report_code} masuk di ".trim(implode(', ', array_filter([$region?->village, $region?->district, $region?->regency]))).'.',
                'data' => json_encode(['report_id' => $report->id, 'report_code' => $report->report_code, 'status' => $report->status]),
                'created_at' => now(),
            ]);
        }
    }
}
