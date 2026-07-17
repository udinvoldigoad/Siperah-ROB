<?php

namespace App\Services;

use App\Models\Prediction;
use App\Support\ForecastWindow;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

final class PredictionService
{
    /**
     * Prediksi dianggap basi bila baris terbaru dibuat lebih lama dari ini —
     * pipeline harian jalan ~06:00 WIB, jadi >30 jam berarti ada run terlewat.
     */
    private const STALE_AFTER_HOURS = 30;

    /** @return array{current: Prediction|null, forecast: Collection<int, Prediction>, status: string, last_generated_at: string|null} */
    public function sevenDayForecast(string $regionId): array
    {
        return $this->forecast($regionId, ForecastWindow::sevenDaysFrom(CarbonImmutable::today()), 7);
    }

    /** @return array{current: Prediction|null, forecast: Collection<int, Prediction>, status: string, last_generated_at: string|null} */
    public function thirtyDayForecast(string $regionId): array
    {
        return $this->forecast($regionId, ForecastWindow::thirtyDaysFrom(CarbonImmutable::today()), 30);
    }

    /**
     * @param array{start: CarbonImmutable, end: CarbonImmutable} $window
     * @return array{current: Prediction|null, forecast: Collection<int, Prediction>, status: string, last_generated_at: string|null}
     */
    private function forecast(string $regionId, array $window, int $limit): array
    {
        $forecast = Prediction::where('region_id', $regionId)
            ->whereBetween('prediction_date', [$window['start']->toDateString(), $window['end']->toDateString()])
            ->orderBy('prediction_date')
            ->limit($limit)
            ->get();

        // "current" = prediksi untuk HARI INI secara eksplisit, bukan sekadar
        // baris pertama (yang bisa jadi tanggal depan bila hari ini bolong).
        $today = CarbonImmutable::today()->toDateString();
        $current = $forecast->firstWhere(fn (Prediction $p) => (string) $p->prediction_date === $today
            || CarbonImmutable::parse($p->prediction_date)->toDateString() === $today);

        $lastGenerated = $forecast->max('generated_at');
        $lastGeneratedAt = $lastGenerated ? CarbonImmutable::parse($lastGenerated) : null;

        $status = match (true) {
            $current === null => 'unavailable',
            $lastGeneratedAt !== null && $lastGeneratedAt->diffInHours(now()) > self::STALE_AFTER_HOURS => 'stale',
            default => 'fresh',
        };

        return [
            'current' => $current,
            'forecast' => $forecast,
            'status' => $status,
            'last_generated_at' => $lastGeneratedAt?->toIso8601String(),
        ];
    }
}
