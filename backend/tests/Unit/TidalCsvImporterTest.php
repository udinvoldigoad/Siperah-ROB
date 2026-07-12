<?php

namespace Tests\Unit;

use App\Services\TidalCsvImporter;
use PHPUnit\Framework\TestCase;

final class TidalCsvImporterTest extends TestCase
{
    public function test_chart_csv_can_be_validated_without_database_write(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'tide');
        file_put_contents($path, "Date,EST,MSL,LAT\n2026-07-12 00:00:00,2.79,0.36,1.04\n2026-07-12 00:10:00,2.76,0.33,1.01\n");

        try {
            $result = (new TidalCsvImporter())->import(
                $path, 'chart', 'TEST', 'Test Station', 'Fixture', 'Asia/Jakarta', 'MSL', true,
            );
        } finally {
            unlink($path);
        }

        self::assertSame(2, $result['rows']);
        self::assertSame(0.33, $result['minimum']);
        self::assertSame(0.36, $result['maximum']);
        self::assertStringStartsWith('2026-07-11T17:00:00', $result['first_at']);
    }
}
