<?php

namespace App\Services;

use App\Models\Prediction;
use App\Support\ForecastWindow;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

final class PredictionService
{
    /** @return array{current: Prediction|null, forecast: Collection<int, Prediction>} */
    public function sevenDayForecast(string $regionId): array
    {
        $window = ForecastWindow::sevenDaysFrom(CarbonImmutable::today());
        $query = Prediction::where('region_id', $regionId)
            ->whereBetween('prediction_date', [
                $window['start']->toDateString(),
                $window['end']->toDateString(),
            ])
            ->orderBy('prediction_date');

        $forecast = (clone $query)->limit(7)->get();

        return [
            'current' => $forecast->first(),
            'forecast' => $forecast,
        ];
    }
}
