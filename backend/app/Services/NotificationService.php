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

        $user = User::find($report->user_id);
        if (!$user) return;

        $notification = new \App\Notifications\ReportStatusUpdatedNotification($report);
        
        $delay = $this->calculateQuietHoursDelay($user);
        if ($delay > 0) {
            $notification->delay(now()->addMinutes($delay));
        }

        $user->notify($notification);
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

            $notification = new \App\Notifications\NewReportReviewNotification($report, $isWithinMonitoringArea);
            
            // Laporan baru tidak sepenting bahaya tinggi, tahan kalau sedang quiet hours
            $delay = $this->calculateQuietHoursDelay($recipient);
            if ($delay > 0) {
                $notification->delay(now()->addMinutes($delay));
            }

            $recipient->notify($notification);
        }
    }

    public function notifyReportSlaOverdue(GroundTruthReport $report): void
    {
        $report->loadMissing('region');
        $region = $report->region;

        $recipients = User::query()
            ->where('status', 'aktif')
            ->whereIn('role', ['bpbd_operator', 'bpbd_provinsi', 'admin'])
            ->get()
            ->filter(function (User $user) use ($region, $report): bool {
                if (in_array($user->role, ['bpbd_provinsi', 'admin'], true)) {
                    return true;
                }

                if (!$user->region_id || !$region) {
                    return $report->status === 'perlu_review';
                }

                return DB::table('regions')
                    ->where('id', $user->region_id)
                    ->where('regency', $region->regency)
                    ->exists();
            });

        foreach ($recipients as $recipient) {
            $alreadySent = DB::table('notification_inbox')
                ->where('user_id', $recipient->id)
                ->where('type', 'report_sla_overdue')
                ->where('data', 'like', "%{$report->report_code}%")
                ->exists();
                
            if ($alreadySent) {
                continue;
            }

            $notification = new \App\Notifications\ReportSlaOverdueNotification($report);
            
            // SLA Overdue adalah peringatan penting, tapi tidak darurat. Kita taati quiet hours.
            $delay = $this->calculateQuietHoursDelay($recipient);
            if ($delay > 0) {
                $notification->delay(now()->addMinutes($delay));
            }

            $recipient->notify($notification);
        }
    }
    
    private function calculateQuietHoursDelay(User $user): int
    {
        $settings = $this->settings($user->id);
        if (!$settings->quiet_start || !$settings->quiet_end) {
            return 0;
        }

        $now = now();
        // Assuming time strings like "22:00:00" or "22:00"
        $start = \Carbon\Carbon::createFromFormat('H:i:s', strlen($settings->quiet_start) === 5 ? $settings->quiet_start.':00' : $settings->quiet_start);
        $end = \Carbon\Carbon::createFromFormat('H:i:s', strlen($settings->quiet_end) === 5 ? $settings->quiet_end.':00' : $settings->quiet_end);

        // If end time is less than start time, it means it crosses midnight
        $isOvernight = $end->lessThan($start);

        $isQuietTime = false;
        if ($isOvernight) {
            $isQuietTime = $now->greaterThanOrEqualTo($start) || $now->lessThanOrEqualTo($end);
        } else {
            $isQuietTime = $now->between($start, $end);
        }

        if ($isQuietTime) {
            $target = $now->copy()->setTimeFrom($end);
            if ($now->greaterThanOrEqualTo($start) && $isOvernight) {
                $target->addDay();
            }
            return $now->diffInMinutes($target);
        }

        return 0;
    }
}
