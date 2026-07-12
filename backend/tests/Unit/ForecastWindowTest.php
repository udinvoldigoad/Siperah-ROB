<?php

namespace Tests\Unit;

use App\Support\ForecastWindow;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

final class ForecastWindowTest extends TestCase
{
    public function test_window_contains_exactly_seven_calendar_days(): void
    {
        $window = ForecastWindow::sevenDaysFrom(
            CarbonImmutable::parse('2026-07-12 14:30:00', 'Asia/Jakarta'),
        );

        self::assertSame('2026-07-12', $window['start']->toDateString());
        self::assertSame('2026-07-18', $window['end']->toDateString());
        self::assertSame('00:00:00', $window['start']->format('H:i:s'));
        self::assertSame('23:59:59', $window['end']->format('H:i:s'));
    }
}
