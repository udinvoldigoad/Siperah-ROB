<?php

namespace App\Services;

use App\Models\GroundTruthReport;
use App\Models\NotificationSetting;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\User;
use App\Notifications\Data\ReportSummary;
use App\Notifications\HighRiskWarningNotification;
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
                'channels' => NotificationSetting::DEFAULT_CHANNELS,
                'event_types' => NotificationSetting::DEFAULT_EVENT_TYPES,
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

        $user->notify(new \App\Notifications\ReportStatusUpdatedNotification(ReportSummary::from($report)));
    }

    public function notifyNewReportForReview(GroundTruthReport $report): void
    {
        $report->loadMissing('region');
        $region = $report->region;

        $isWithinMonitoringArea = $this->monitoring->isReportWithinMonitoringArea($report);
        // Cuplikan dibuat SEKALI di luar loop: isinya sama untuk semua penerima,
        // dan sejak notifikasi tak lagi membawa model, laporan yang terhapus
        // sebelum antrean sempat jalan tidak lagi menggagalkan job.
        $summary = ReportSummary::from($report);

        // Penyaringan per penerima dilakukan di dalam loop (preferensi event &
        // wilayah); di sini cukup ambil kandidatnya.
        $recipients = User::query()
            ->where('status', 'aktif')
            ->whereIn('role', ['admin'])
            ->get();

        foreach ($recipients as $recipient) {
            $settings = $this->settings($recipient->id);
            if (!in_array('laporan_ground_truth', $settings->event_types ?? [], true)) {
                continue;
            }

            // Preferensi wilayah pantau dihormati juga untuk laporan luar area
            // pantau (region tetap ter-assign ke tetangga terdekat) — tanpa ini
            // laporan triase membanjiri user yang sudah membatasi wilayahnya.
            $monitored = $settings->monitored_regions ?? [];
            if ($monitored !== [] && $region && !$this->matchesMonitoredRegions($region, $monitored)) {
                continue;
            }

            $recipient->notify(new \App\Notifications\NewReportReviewNotification($summary, $isWithinMonitoringArea));
        }
    }

    /**
     * SLA overdue adalah eskalasi tugas, bukan langganan: preferensi
     * event_types/monitored_regions sengaja TIDAK diterapkan — petugas tetap
     * harus tahu ada laporan yang melewati SLA di wilayah kerjanya.
     */
    public function notifyReportSlaOverdue(GroundTruthReport $report): void
    {
        $summary = ReportSummary::from($report);

        $recipients = User::query()
            ->where('status', 'aktif')
            ->whereIn('role', ['admin'])
            ->get();

        foreach ($recipients as $recipient) {
            $alreadySent = DB::table('notification_inbox')
                ->where('user_id', $recipient->id)
                ->where('type', 'report_sla_overdue')
                ->where('data', 'like', "%{$summary->code}%")
                ->exists();
                
            if ($alreadySent) {
                continue;
            }

            $recipient->notify(new \App\Notifications\ReportSlaOverdueNotification($summary));
        }
    }
    
    /**
     * Peringatan KRITIS risiko Sangat Tinggi pada tanggal prediksi tertentu.
     * Sengaja TANPA delay quiet hours: bahaya keselamatan harus sampai kapan
     * pun (kontras dengan notifikasi non-kritis di atas).
     *
     * Cakupan per penerima konsisten dengan region-nya:
     * - warga/peneliti: difilter monitored_regions bila diisi, semua bila kosong;
     * - admin: seluruh provinsi.
     *
     * @return int jumlah penerima yang dikirimi
     */
    public function notifyHighRiskPredictions(string $predictionDate): int
    {
        $predictions = Prediction::with('region')
            ->whereDate('prediction_date', $predictionDate)
            ->where('risk_class', 'sangat_tinggi')
            ->get()
            ->filter(fn (Prediction $prediction) => $prediction->region !== null)
            ->values();

        if ($predictions->isEmpty()) {
            return 0;
        }

        $sent = 0;
        $recipients = User::query()->where('status', 'aktif')->get();

        foreach ($recipients as $recipient) {
            $settings = $this->settings($recipient->id);
            if (!in_array('bahaya_sangat_tinggi', $settings->event_types ?? [], true)) {
                continue;
            }

            $scoped = $predictions;
            if (in_array($recipient->role, ['warga', 'peneliti'], true)) {
                $monitored = $settings->monitored_regions ?? [];
                if ($monitored !== []) {
                    $scoped = $predictions->filter(fn (Prediction $prediction) => $this->matchesMonitoredRegions($prediction->region, $monitored));
                }
            }

            if ($scoped->isEmpty()) {
                continue;
            }

            // Satu peringatan per user per tanggal prediksi (command boleh
            // dijalankan berulang tanpa spam).
            $alreadySent = DB::table('notification_inbox')
                ->where('user_id', $recipient->id)
                ->where('type', 'high_risk_warning')
                ->where('data', 'like', '%'.$predictionDate.'%')
                ->exists();
            if ($alreadySent) {
                continue;
            }

            $regionNames = $scoped
                ->map(fn (Prediction $prediction) => $prediction->region->village)
                ->filter()
                ->unique()
                ->values()
                ->all();

            $recipient->notify(new HighRiskWarningNotification($predictionDate, $regionNames, count($regionNames)));
            $sent++;
        }

        return $sent;
    }

    /**
     * Matching langganan wilayah (monitored_regions berisi nama bebas) ke
     * sebuah region — dipakai SEMUA jalur notifikasi agar konsisten.
     */
    private function matchesMonitoredRegions(Region $region, array $monitored): bool
    {
        // Normalisasi prefiks "Kota/Kabupaten": DB menyimpan "Kota Bandar
        // Lampung" sedangkan UI menawarkan "Bandar Lampung" — tanpa ini
        // langganan wilayah tidak pernah cocok dan notifikasi hilang diam-diam.
        $normalize = static fn (string $name): string => trim(
            (string) preg_replace('/^(kabupaten|kota)\s+/i', '', mb_strtolower(trim($name)))
        );
        $haystack = array_map($normalize, array_filter([$region->village, $region->district, $region->regency]));

        return collect($monitored)->contains(
            fn (string $item) => in_array($normalize($item), $haystack, true)
        );
    }

}
