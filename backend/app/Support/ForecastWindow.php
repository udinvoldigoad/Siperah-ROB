<?php

namespace App\Support;

use Carbon\CarbonImmutable;

final class ForecastWindow
{
    /** @return array{start: CarbonImmutable, end: CarbonImmutable} */
    public static function sevenDaysFrom(CarbonImmutable $date): array
    {
        $start = $date->startOfDay();

        return [
            'start' => $start,
            'end' => $start->addDays(6)->endOfDay(),
        ];
    }

    /** @return array{start: CarbonImmutable, end: CarbonImmutable} */
    public static function thirtyDaysFrom(CarbonImmutable $date): array
    {
        $start = $date->startOfDay();

        return [
            'start' => $start,
            'end' => $start->addDays(29)->endOfDay(),
        ];
    }
}
