<?php

namespace Tests\Unit;

use App\Support\AppTime;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Mengunci anchor hari kalender ke WIB.
 *
 * Jam rawan: 00:00–07:00 WIB masih "kemarin" menurut UTC. Rentang itu memuat
 * pipeline ML 06:00 dan notifikasi risiko tinggi 06:30 WIB, jadi satu saja
 * pemakaian `today()` polos membuat peta/dashboard menampilkan tanggal berbeda
 * dari tanggal yang dipakai notifikasi.
 */
final class AppTimeTest extends TestCase
{
    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    /** Jam-jam UTC yang di WIB sudah masuk tanggal berikutnya. */
    public static function preDawnMoments(): array
    {
        return [
            'tepat tengah malam WIB' => ['2026-07-27 17:00:00', '2026-07-28'],
            'pipeline ML 06:00 WIB' => ['2026-07-27 23:00:00', '2026-07-28'],
            'notifikasi 06:30 WIB' => ['2026-07-27 23:30:00', '2026-07-28'],
        ];
    }

    #[DataProvider('preDawnMoments')]
    public function test_today_follows_wib_calendar_day(string $utcNow, string $expectedDate): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse($utcNow, 'UTC'));

        self::assertSame($expectedDate, AppTime::todayString());
        self::assertSame($expectedDate, AppTime::today()->toDateString());
        // Bukti bahwa anchor polos memang berbeda di jam ini — kalau assertion
        // ini gagal, contoh waktunya tak lagi menguji apa pun.
        self::assertNotSame(
            CarbonImmutable::today('UTC')->toDateString(),
            AppTime::todayString(),
            'Contoh waktu harus berada di jam ketika UTC & WIB beda tanggal.',
        );
    }

    public function test_utc_and_wib_agree_again_from_seven_in_the_morning(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-07-28 00:00:00', 'UTC'));

        self::assertSame('2026-07-28', AppTime::todayString());
        self::assertSame(CarbonImmutable::today('UTC')->toDateString(), AppTime::todayString());
    }

    public function test_day_bounds_are_wib_midnight_expressed_in_utc(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-07-27 23:30:00', 'UTC'));

        // Tengah malam WIB 28 Juli = 17:00 UTC 27 Juli.
        self::assertSame('2026-07-27 17:00:00', AppTime::startOfDayUtc()->format('Y-m-d H:i:s'));
        self::assertSame('2026-07-28 16:59:59', AppTime::endOfDayUtc()->format('Y-m-d H:i:s'));
        self::assertSame('UTC', AppTime::startOfDayUtc()->timezoneName);

        self::assertSame('2026-07-01 17:00:00', AppTime::startOfDayUtc('2026-07-02')->format('Y-m-d H:i:s'));
    }

    public function test_month_bounds_are_wib_and_accept_year_month(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-07-27 23:30:00', 'UTC'));

        // Awal Juli WIB = 30 Juni 17:00 UTC.
        self::assertSame('2026-06-30 17:00:00', AppTime::startOfMonthUtc()->format('Y-m-d H:i:s'));
        self::assertSame('2026-06-30 17:00:00', AppTime::startOfMonthUtc('2026-07')->format('Y-m-d H:i:s'));
        self::assertSame('2026-07-31 16:59:59', AppTime::endOfMonthUtc('2026-07')->format('Y-m-d H:i:s'));
    }

    /**
     * Kolom bertipe `date` dibandingkan sebagai tanggal kalender — memakai
     * varian *Utc lalu toDateString() akan meleset satu hari.
     */
    public function test_month_date_strings_stay_on_the_calendar_month(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-07-27 23:30:00', 'UTC'));

        self::assertSame('2026-07-01', AppTime::monthStartDate('2026-07'));
        self::assertSame('2026-07-31', AppTime::monthEndDate('2026-07'));
        self::assertSame('2028-02-29', AppTime::monthEndDate('2028-02'));
        self::assertSame('2026-07-01', AppTime::monthStartDate());
    }

    public function test_sql_date_expression_shifts_column_to_wib(): void
    {
        self::assertSame(
            "CAST(created_at AT TIME ZONE 'Asia/Jakarta' AS date)",
            AppTime::sqlDateInWib('created_at'),
        );
    }
}
