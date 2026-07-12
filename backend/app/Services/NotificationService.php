<?php

namespace App\Services;

use App\Models\GroundTruthReport;
use App\Models\NotificationSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class NotificationService
{
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
}
